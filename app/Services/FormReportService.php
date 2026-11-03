<?php

namespace App\Services;

use App\Models\Form;
use App\Models\Ticket;
use App\Models\User;
use App\Support\ApiException;
use App\Support\AuthUser;
use App\Utils\FormFields;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Report for one form: what clients ticked, how requests are moving, who handles them.
 * Everything comes from the form's own field definitions and the tickets sent with it,
 * so a new form needs no code change.
 */
class FormReportService
{
    private const CHOICE_TYPES = ['checkbox', 'radio', 'dropdown'];

    /** A request should be closed within this many days. */
    private const TARGET_DAYS = 3;

    private const FINISHED_STATUSES = ['closed', 'rejected'];

    private const PAGE_SIZE = 10;

    public function __construct(private DivisionStatsService $divisions) {}

    /**
     * The published forms the user created (every form for a super admin). Picking one in My Forms counts its own tickets by what the
     * clients ticked in that form.
     *
     * @return Collection<int, Form>
     */
    public function accessibleForms(AuthUser $user, string $search = ''): Collection
    {
        $forms = Form::query()->where('status', 'published')->orderBy('title')->get();
        // Only the forms the admin created; a super admin sees every form.
        if ($user->role !== 'super_admin') {
            $forms = $forms->filter(fn (Form $f) => (string) $f->created_by === $user->id);
        }

        $units = [];
        $unitOf = function (string $creatorId) use (&$units): string {
            if (! array_key_exists($creatorId, $units)) {
                $creator = User::query()->find($creatorId);
                $units[$creatorId] = $creator ? $this->divisions->unitFor($creator) : '';
            }

            return $units[$creatorId];
        };

        $forms = $forms->each(fn (Form $f) => $f->setAttribute('office', $unitOf((string) $f->created_by)));

        $needle = mb_strtolower(trim($search));
        if ($needle !== '') {
            $forms = $forms->filter(fn (Form $f) => str_contains(mb_strtolower($f->title.' '.$f->ref_number), $needle));
        }

        return $forms->values();
    }

    /** @return list<array<string, mixed>> */
    public function formList(AuthUser $user, string $search = ''): array
    {
        return $this->accessibleForms($user, $search)->map(fn (Form $f) => $this->formSummary($f))->all();
    }

    public function findAccessible(AuthUser $user, string $formId): Form
    {
        $form = $this->accessibleForms($user)->firstWhere('id', $formId);
        if (! $form) {
            // Same answer for "missing" and "not yours", so ids of other offices are not revealed.
            throw new ApiException(404, 'Form not found');
        }

        return $form;
    }

    /** @return array<string, mixed> */
    public function report(AuthUser $user, string $formId, ?string $from, ?string $to, bool $closedOnly = false): array
    {
        $form = $this->findAccessible($user, $formId);
        [$start, $end] = $this->range($from, $to);

        $tickets = $this->scoped($form, $start, $end)
            ->with('assignees')
            ->get(['id', 'ticket_number', 'creator_name', 'division', 'status', 'answers', 'created_at', 'updated_at']);
        // A request only shows up once the client has closed it.
        if ($closedOnly) {
            $tickets = $tickets->where('status', 'closed')->values();
        }

        $closed = $tickets->where('status', 'closed');
        $rejected = $tickets->where('status', 'rejected')->count();
        $open = $tickets->reject(fn (Ticket $t) => in_array($t->status, self::FINISHED_STATUSES, true));
        $total = $tickets->count();

        // The same-length period just before this one, for the "compared with before" lines.
        $length = max(1, $start->diffInDays($end) + 1);
        $prevEnd = $start->copy()->subSecond();
        $prevStart = $start->copy()->subDays($length);
        $prev = $this->scoped($form, $prevStart, $prevEnd)->get(['status', 'created_at', 'updated_at']);

        $daysToClose = fn (Collection $c) => $c->map(fn (Ticket $t) => $this->days($t->created_at, $t->updated_at));
        $avg = $this->avg($daysToClose($closed));
        $prevAvg = $this->avg($daysToClose($prev->where('status', 'closed')));
        $withinTarget = $daysToClose($closed)->filter(fn ($d) => $d <= self::TARGET_DAYS)->count();

        $now = now();
        $openRows = $open->sortBy('created_at')->values();

        return [
            'form' => $this->formSummary($form),
            'range' => ['from' => $start->toDateString(), 'to' => $end->toDateString()],
            'kpis' => [
                'requests' => $total,
                'open' => $open->count(),
                'closed' => $closed->count(),
                'rejected' => $rejected,
                'completionRate' => $total > 0 ? (int) round($closed->count() / $total * 100) : 0,
                'requestsVsPrevious' => $total - $prev->count(),
                'avgDaysToClose' => $avg,
                'avgDaysVsPrevious' => $avg !== null && $prevAvg !== null ? round($avg - $prevAvg, 1) : null,
                'targetDays' => self::TARGET_DAYS,
                'closedWithinTarget' => $withinTarget,
                'withinTargetPercent' => $closed->count() > 0 ? (int) round($withinTarget / $closed->count() * 100) : 0,
                'openPastTarget' => $openRows->filter(fn (Ticket $t) => $this->days($t->created_at, $now) > self::TARGET_DAYS)->count(),
            ],
            // A type counts once the client has closed the request.
            'groups' => $this->groups($form, $closed, $hasLegacy),
            'hasLegacyAnswers' => $hasLegacy,
            'personnel' => $this->personnel($tickets),
            'openRequests' => $openRows->take(5)->map(fn (Ticket $t) => [
                '_id' => (string) $t->id,
                'ticketNumber' => $t->ticket_number,
                'creatorName' => $t->creator_name,
                'assignedTo' => $t->assignees->pluck('name')->implode(', '),
                'daysOpen' => (int) floor($this->days($t->created_at, $now)),
                'pastTarget' => $this->days($t->created_at, $now) > self::TARGET_DAYS,
            ])->all(),
            'byDivision' => $this->byDivision($tickets),
            'perMonth' => $this->perMonth($form, (int) $end->year),
        ];
    }

    /** @return array<int, array<string, mixed>> One row per month of the year. */
    private function perMonth(Form $form, int $year): array
    {
        $tickets = $this->scoped($form, Carbon::create($year, 1, 1)->startOfDay(), Carbon::create($year, 12, 31)->endOfDay())
            ->get(['status', 'created_at', 'updated_at']);

        return collect(range(1, 12))->map(function (int $m) use ($tickets, $year) {
            $rows = $tickets->filter(fn (Ticket $t) => (int) $t->created_at->month === $m);
            $closed = $rows->where('status', 'closed');
            $days = $closed->map(fn (Ticket $t) => $this->days($t->created_at, $t->updated_at));

            $perDay = $rows->groupBy(fn (Ticket $t) => (int) $t->created_at->day)->sortKeys()->map(function (Collection $day, int $d) {
                $dayClosed = $day->where('status', 'closed');
                $dayDays = $dayClosed->map(fn (Ticket $t) => $this->days($t->created_at, $t->updated_at));

                return [
                    'day' => $d,
                    'requests' => $day->count(),
                    'closed' => $dayClosed->count(),
                    'open' => $day->reject(fn (Ticket $t) => in_array($t->status, self::FINISHED_STATUSES, true))->count(),
                    'avgDays' => $this->avg($dayDays),
                    'withinTarget' => $dayDays->filter(fn ($x) => $x <= self::TARGET_DAYS)->count(),
                ];
            })->values()->all();

            return [
                'month' => sprintf('%d-%02d', $year, $m),
                'daily' => $perDay,
                'requests' => $rows->count(),
                'closed' => $closed->count(),
                'open' => $rows->reject(fn (Ticket $t) => in_array($t->status, self::FINISHED_STATUSES, true))->count(),
                'avgDays' => $this->avg($days),
                'withinTarget' => $days->filter(fn ($d) => $d <= self::TARGET_DAYS)->count(),
            ];
        })->all();
    }

    /** @return array<string, mixed> */
    public function requests(AuthUser $user, string $formId, array $query): array
    {
        $form = $this->findAccessible($user, $formId);
        [$start, $end] = $this->range($query['from'] ?? null, $query['to'] ?? null);
        $builder = $this->scoped($form, $start, $end);

        $status = (string) ($query['status'] ?? 'all');
        if ($status === 'open') {
            $builder->whereNotIn('status', self::FINISHED_STATUSES);
        } elseif (in_array($status, self::FINISHED_STATUSES, true)) {
            $builder->where('status', $status);
        }

        $q = trim((string) ($query['q'] ?? ''));
        if ($q !== '') {
            $builder->where(function (Builder $w) use ($q) {
                $like = '%'.$q.'%';
                $w->where('ticket_number', 'like', $like)
                    ->orWhere('creator_name', 'like', $like)
                    ->orWhere('title', 'like', $like)
                    ->orWhere('division', 'like', $like);
            });
        }

        // "Only requests that ticked this option": filter by field id and option label.
        $fieldId = (string) ($query['fieldId'] ?? '');
        $option = (string) ($query['option'] ?? '');
        if ($fieldId !== '' && $option !== '') {
            $field = collect(FormFields::normalize($form->fields ?? []))->first(fn ($f) => ($f['id'] ?? null) === $fieldId);
            if ($field) {
                $builder->where(function (Builder $w) use ($field, $option) {
                    foreach ($this->answerKeys($field) as $key) {
                        $path = '$."'.str_replace(['\\', '"'], ['\\\\', '\\"'], $key).'"';
                        $w->orWhereRaw('JSON_CONTAINS(answers, ?, ?)', [json_encode($option, JSON_UNESCAPED_UNICODE), $path]);
                        $w->orWhereRaw('JSON_UNQUOTE(JSON_EXTRACT(answers, ?)) = ?', [$path, $option]);
                    }
                });
            }
        }

        $page = max(1, (int) ($query['page'] ?? 1));
        $total = (clone $builder)->count();
        $items = $builder->orderByDesc('created_at')
            ->skip(($page - 1) * self::PAGE_SIZE)
            ->limit(self::PAGE_SIZE)
            ->get(['id', 'ticket_number', 'creator_name', 'division', 'status', 'created_at'])
            ->map(fn (Ticket $t) => [
                '_id' => (string) $t->id,
                'ticketNumber' => $t->ticket_number,
                'creatorName' => $t->creator_name,
                'division' => $t->division ?? '',
                'status' => $t->status,
                'createdAt' => $t->created_at?->toIso8601String(),
            ])->all();

        return ['items' => $items, 'total' => $total, 'page' => $page, 'pageSize' => self::PAGE_SIZE];
    }

    /**
     * Every closed request of the form in the period, with what the client filled in,
     * for the "pick a closed ticket" dropdown.
     *
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function closedTickets(AuthUser $user, string $formId, ?string $from, ?string $to): array
    {
        $form = $this->findAccessible($user, $formId);
        [$start, $end] = $this->range($from, $to);
        $fields = collect($this->withDisplayLabels(FormFields::normalize($form->fields ?? [])))->reject(fn ($f) => ($f['type'] ?? '') === 'signature')->values();

        $tickets = $this->scoped($form, $start, $end)
            ->where('status', 'closed')
            ->orderByDesc('updated_at')
            ->limit(200)
            ->get(['id', 'ticket_number', 'title', 'creator_name', 'division', 'answers', 'created_at', 'updated_at']);

        $items = $tickets->map(function (Ticket $t) use ($fields) {
            $answers = is_array($t->answers) ? $t->answers : [];

            return [
                '_id' => (string) $t->id,
                'ticketNumber' => $t->ticket_number,
                'title' => $t->title,
                'creatorName' => $t->creator_name,
                'division' => $t->division ?? '',
                'createdAt' => $t->created_at?->toIso8601String(),
                'closedAt' => $t->updated_at?->toIso8601String(),
                'choices' => $this->choicesOf($fields, $answers),
                'answers' => $fields->map(function (array $f) use ($answers) {
                    $value = null;
                    foreach ($this->answerKeys($f) as $key) {
                        if (array_key_exists($key, $answers)) {
                            $value = $answers[$key];
                            break;
                        }
                    }
                    $value = is_array($value) ? implode(', ', array_map('strval', $value)) : trim((string) ($value ?? ''));

                    return [
                        'label' => (string) $f['label'],
                        'type' => (string) ($f['type'] ?? ''),
                        'value' => $value,
                    ];
                })->all(),
            ];
        })->all();

        return ['items' => $items, 'total' => count($items)];
    }

    private const REPORT_TYPES = ['donut', 'pie', 'bar', 'column', 'tiles', 'table', 'none'];

    private const REPORT_SKIP_TYPES = ['signature', 'file'];

    /**
     * The fields of a form the owner can lay out in the report, with what was chosen so far.
     *
     * @return array<string, mixed>
     */
    public function reportSettings(AuthUser $user, string $formId): array
    {
        $form = $this->findAccessible($user, $formId);
        $fields = $this->reportableFields($form);
        $config = is_array($form->report_config) ? $form->report_config : null;

        return [
            'fields' => collect($fields)->map(fn (array $f) => [
                'fieldId' => (string) $f['id'],
                'label' => (string) $f['label'],
                'type' => (string) ($f['type'] ?? ''),
                'optionCount' => in_array($f['type'] ?? null, self::CHOICE_TYPES, true) ? count($f['options'] ?? []) : null,
                'chosen' => $config[(string) $f['id']] ?? null,
            ])->all(),
            'configured' => $config !== null,
        ];
    }

    /**
     * @param  array<string, mixed>  $choices  fieldId => donut|bar|table|none
     * @return array<string, mixed>
     */
    public function saveReportSettings(AuthUser $user, string $formId, array $choices): array
    {
        $form = $this->findAccessible($user, $formId);
        $valid = collect($this->reportableFields($form))->pluck('id')->map(fn ($id) => (string) $id)->all();
        $config = [];
        foreach ($choices as $fieldId => $type) {
            if (in_array((string) $fieldId, $valid, true) && in_array($type, self::REPORT_TYPES, true)) {
                $config[(string) $fieldId] = $type;
            }
        }
        // Not $form->save(): accessibleForms() adds a display-only "office" attribute to the model.
        Form::query()->whereKey($form->getKey())->update(['report_config' => json_encode($config), 'updated_at' => $form->updated_at]);

        return $this->reportSettings($user, $formId);
    }

    /**
     * Closed tickets only, one card per field the owner chose to show.
     *
     * @return array<string, mixed>
     */
    public function dynamicReport(AuthUser $user, string $formId, ?string $from, ?string $to): array
    {
        $form = $this->findAccessible($user, $formId);
        $config = is_array($form->report_config) ? $form->report_config : [];
        $fields = $this->reportableFields($form);
        [$start, $end] = $this->range($from, $to);
        $tickets = $this->scoped($form, $start, $end)->where('status', 'closed')->get(['id', 'answers', 'creator_name', 'creator_email', 'division']);

        $shown = collect($fields)->filter(fn (array $f) => ! in_array($config[(string) $f['id']] ?? 'none', ['none'], true))->values();
        $cards = $shown->map(function (array $f) use ($config, $tickets) {
            $counts = [];
            foreach ($tickets as $t) {
                $answers = is_array($t->answers) ? $t->answers : [];
                foreach ($this->valuesOf($f, $answers, $t) as $v) {
                    $k = mb_strtolower($v);
                    $counts[$k] = ['label' => $counts[$k]['label'] ?? $v, 'count' => ($counts[$k]['count'] ?? 0) + 1];
                }
            }
            // Options with no answers still show in a choice field, so the chart matches the form.
            if (in_array($f['type'] ?? null, self::CHOICE_TYPES, true)) {
                foreach ($f['options'] ?? [] as $o) {
                    $label = trim((string) (is_array($o) ? ($o['label'] ?? '') : $o));
                    if ($label !== '' && ! isset($counts[mb_strtolower($label)])) {
                        $counts[mb_strtolower($label)] = ['label' => $label, 'count' => 0];
                    }
                }
            }
            $rows = collect($counts)->values()->sortByDesc('count')->values();
            $type = (string) $config[(string) $f['id']];
            $distinct = $rows->count();
            $total = (int) $rows->sum('count');
            $limit = $type === 'table' ? 5 : 5;
            $top = $rows->take($limit);
            $rest = (int) $rows->slice($limit)->sum('count');
            $items = $top->map(fn ($r) => ['label' => $r['label'], 'count' => $r['count']])->all();
            if ($rest > 0 && $type !== 'table') {
                $items[] = ['label' => 'Others', 'count' => $rest];
            }
            // A bar chart of a choice field keeps every option, in the form's order.
            if (in_array($type, ['bar', 'column'], true) && in_array($f['type'] ?? null, self::CHOICE_TYPES, true)) {
                $items = $rows->map(fn ($r) => ['label' => $r['label'], 'count' => $r['count']])->all();
                $order = collect($f['options'] ?? [])->map(fn ($o) => mb_strtolower(trim((string) (is_array($o) ? ($o['label'] ?? '') : $o))))->flip();
                usort($items, fn ($a, $b) => ($order[mb_strtolower($a['label'])] ?? 999) <=> ($order[mb_strtolower($b['label'])] ?? 999));
            }

            return [
                'fieldId' => (string) $f['id'],
                'label' => (string) $f['label'],
                'type' => $type,
                'total' => $total,
                'distinct' => $distinct,
                'items' => $items,
                // A table list is exported whole, so every answer is kept (capped), not only the top 5 shown.
                'all' => $type === 'table' ? $rows->take(5000)->map(fn ($r) => ['label' => $r['label'], 'count' => $r['count']])->all() : [],
            ];
        })->all();

        return [
            'closedCount' => $tickets->count(),
            'hiddenCount' => count($fields) - $shown->count(),
            'configured' => ! empty($config),
            'cards' => $cards,
        ];
    }

    /** @return list<array<string, mixed>> */
    private function reportableFields(Form $form): array
    {
        $own = collect($this->withDisplayLabels(FormFields::normalize($form->fields ?? [])))
            ->reject(fn ($f) => in_array($f['type'] ?? '', self::REPORT_SKIP_TYPES, true))
            ->values()
            ->all();

        // Filled in from the requestor's profile on every ticket, so they are not Form Builder fields.
        $profile = [
            ['id' => 'prof_division', 'label' => 'Division/Section'],
            ['id' => 'prof_requestor', 'label' => "Requestor's Name"],
            ['id' => 'prof_designation', 'label' => 'Designation'],
            ['id' => 'prof_email', 'label' => 'Email Address'],
        ];

        return [...array_map(fn ($f) => $f + ['type' => 'textbox', 'profile' => true], $profile), ...$own];
    }

    /**
     * What a ticket answered for a field, as plain strings (one per ticked option for choice fields).
     *
     * @param  array<string, mixed>  $field
     * @param  array<string, mixed>  $answers
     * @return list<string>
     */
    private function valuesOf(array $field, array $answers, ?Ticket $ticket = null): array
    {
        if (! empty($field['profile'])) {
            $a = fn (string $k) => trim((string) ($answers['{{'.$k.'}}'] ?? ''));
            $v = match ($field['id']) {
                'prof_division' => $a('prof_division') ?: trim((string) $ticket?->division),
                'prof_requestor' => trim(implode(' ', array_filter([$a('prof_first'), $a('prof_middle'), $a('prof_last')]))) ?: trim((string) $ticket?->creator_name),
                'prof_designation' => $a('prof_designation'),
                default => $a('prof_email') ?: trim((string) $ticket?->creator_email),
            };

            return $v === '' ? [] : [$v];
        }

        $value = null;
        foreach ($this->answerKeys($field) as $key) {
            if (array_key_exists($key, $answers)) {
                $value = $answers[$key];
                break;
            }
        }
        $list = is_array($value) ? $value : [$value];

        return collect($list)->map(fn ($v) => trim((string) ($v ?? '')))->filter(fn ($v) => $v !== '')->values()->all();
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function range(?string $from, ?string $to): array
    {
        $parse = function (?string $v, Carbon $fallback): Carbon {
            try {
                return $v ? Carbon::parse($v) : $fallback;
            } catch (\Throwable) {
                return $fallback;
            }
        };

        return [
            $parse($from, now()->startOfMonth())->startOfDay(),
            $parse($to, now())->endOfDay(),
        ];
    }

    private function scoped(Form $form, Carbon $start, Carbon $end): Builder
    {
        return Ticket::query()
            ->where('form_id', $form->id)
            ->whereBetween('created_at', [$start, $end]);
    }

    private function days(?\DateTimeInterface $from, ?\DateTimeInterface $to): float
    {
        if (! $from || ! $to) {
            return 0.0;
        }

        return max(0, ($to->getTimestamp() - $from->getTimestamp()) / 86400);
    }

    private function avg(Collection $values): ?float
    {
        return $values->isEmpty() ? null : round($values->avg(), 1);
    }

    /**
     * Requests handled by each person in charge: how many were assigned, closed and still open.
     *
     * @param  Collection<int, Ticket>  $tickets
     * @return array<string, mixed>
     */
    private function personnel(Collection $tickets): array
    {
        $rows = [];
        $unassigned = ['assigned' => 0, 'closed' => 0, 'open' => 0];

        foreach ($tickets as $t) {
            $isClosed = $t->status === 'closed';
            $isOpen = ! in_array($t->status, self::FINISHED_STATUSES, true);
            if ($t->assignees->isEmpty()) {
                $unassigned['assigned']++;
                $unassigned['closed'] += $isClosed ? 1 : 0;
                $unassigned['open'] += $isOpen ? 1 : 0;

                continue;
            }
            foreach ($t->assignees as $person) {
                $rows[$person->id] ??= ['userId' => (string) $person->id, 'name' => $person->name, 'assigned' => 0, 'closed' => 0, 'open' => 0];
                $rows[$person->id]['assigned']++;
                $rows[$person->id]['closed'] += $isClosed ? 1 : 0;
                $rows[$person->id]['open'] += $isOpen ? 1 : 0;
            }
        }

        $rows = collect($rows)->sortByDesc('assigned')->values()->map(function (array $r) {
            $r['percentClosed'] = $r['assigned'] > 0 ? (int) round($r['closed'] / $r['assigned'] * 100) : 0;

            return $r;
        })->all();

        return [
            'rows' => $rows,
            'unassigned' => $unassigned['assigned'] > 0 ? $unassigned : null,
            'total' => [
                'assigned' => $tickets->count(),
                'closed' => $tickets->where('status', 'closed')->count(),
                'open' => $tickets->reject(fn (Ticket $t) => in_array($t->status, self::FINISHED_STATUSES, true))->count(),
            ],
        ];
    }

    /** @return list<array{name: string, count: int}> */
    private function byDivision(Collection $tickets): array
    {
        return $tickets
            ->groupBy(fn (Ticket $t) => trim((string) $t->division) !== '' ? trim((string) $t->division) : 'Unspecified')
            ->map(fn ($g, $name) => ['name' => (string) $name, 'count' => $g->count()])
            ->sortByDesc('count')
            ->take(6)
            ->values()
            ->all();
    }

    /**
     * One group per choice field, with a count of requests for every option.
     *
     * @param  Collection<int, Ticket>  $tickets
     * @return list<array<string, mixed>>
     */
    private function groups(Form $form, Collection $tickets, ?bool &$hasLegacy): array
    {
        $hasLegacy = false;
        $groups = [];
        foreach ($this->withDisplayLabels(FormFields::normalize($form->fields ?? [])) as $field) {
            if (! in_array($field['type'] ?? null, self::CHOICE_TYPES, true)) {
                continue;
            }
            $options = array_values(array_filter(array_map('strval', $field['options'] ?? []), fn ($o) => trim($o) !== ''));
            if ($options === []) {
                continue;
            }
            $group = $this->groupFor($field, $options, $tickets);
            $hasLegacy = $hasLegacy || $group['hasLegacy'];
            $groups[] = $group;
        }

        return $groups;
    }

    private const TYPE_NAMES = [
        'textbox' => 'Textbox', 'textarea' => 'Textarea', 'dropdown' => 'Dropdown', 'checkbox' => 'Checkbox',
        'radio' => 'Radio', 'date' => 'Date', 'time' => 'Time', 'datetime' => 'Date & time',
        'file' => 'File upload', 'email' => 'Email', 'number' => 'Number', 'signature' => 'Signature',
    ];

    /**
     * A field the admin left unnamed (or named after its {{variable}}) is called by its type instead,
     * numbered when the form has several of that type: "Checkbox 1", "Checkbox 2".
     *
     * @param  list<array<string, mixed>>  $fields
     * @return list<array<string, mixed>>
     */
    private function withDisplayLabels(array $fields): array
    {
        $unnamed = fn (array $f) => trim((string) ($f['label'] ?? '')) === '' || preg_match('/^\{\{.*\}\}$/', trim((string) $f['label'])) === 1;
        $perType = [];
        foreach ($fields as $f) {
            if ($unnamed($f)) {
                $t = (string) ($f['type'] ?? '');
                $perType[$t] = ($perType[$t] ?? 0) + 1;
            }
        }
        $seen = [];
        foreach ($fields as &$f) {
            if (! $unnamed($f)) {
                continue;
            }
            $t = (string) ($f['type'] ?? '');
            $seen[$t] = ($seen[$t] ?? 0) + 1;
            $name = self::TYPE_NAMES[$t] ?? 'Field';
            $f['label'] = ($perType[$t] ?? 0) > 1 ? $name.' '.$seen[$t] : $name;
        }
        unset($f);

        return $fields;
    }

    /**
     * What one ticket ticked in each choice field, keyed by the field id, so the donuts can show one ticket.
     *
     * @param  Collection<int, array<string, mixed>>  $fields
     * @param  array<string, mixed>  $answers
     * @return array<string, list<string>>
     */
    private function choicesOf(Collection $fields, array $answers): array
    {
        $out = [];
        foreach ($fields as $f) {
            if (! in_array($f['type'] ?? null, self::CHOICE_TYPES, true)) {
                continue;
            }
            $raw = null;
            foreach ($this->answerKeys($f) as $key) {
                if (array_key_exists($key, $answers)) {
                    $raw = $answers[$key];
                    break;
                }
            }
            $out[(string) ($f['id'] ?? $f['variable'] ?? '')] = array_values(array_unique(array_filter(
                array_map(fn ($v) => trim((string) $v), is_array($raw) ? $raw : [$raw]),
                fn ($v) => $v !== '' && $v !== 'false',
            )));
        }

        return $out;
    }

    /** @return list<string> */
    private function answerKeys(array $field): array
    {
        $variable = (string) ($field['variable'] ?? $field['id'] ?? '');
        $inner = preg_replace('/^\{\{|\}\}$/', '', $variable);

        return array_values(array_unique(array_filter([$variable, $inner, '{{'.$inner.'}}'])));
    }

    /**
     * @param  list<string>  $options
     * @param  Collection<int, Ticket>  $tickets
     * @return array<string, mixed>
     */
    private function groupFor(array $field, array $options, Collection $tickets): array
    {
        $keys = $this->answerKeys($field);
        $counts = array_fill_keys($options, 0);
        $legacy = [];
        $answered = 0;

        foreach ($tickets as $ticket) {
            $answers = is_array($ticket->answers) ? $ticket->answers : [];
            $raw = null;
            foreach ($keys as $key) {
                if (array_key_exists($key, $answers)) {
                    $raw = $answers[$key];
                    break;
                }
            }
            $picked = array_values(array_unique(array_filter(
                array_map(fn ($v) => trim((string) $v), is_array($raw) ? $raw : [$raw]),
                fn ($v) => $v !== '' && $v !== 'false',
            )));
            if ($picked === []) {
                continue;
            }
            $answered++;
            foreach ($picked as $value) {
                if (array_key_exists($value, $counts)) {
                    $counts[$value]++;
                } else {
                    // Ticked an option the form no longer has (the form was edited later).
                    $legacy[$value] = ($legacy[$value] ?? 0) + 1;
                }
            }
        }

        $rows = [];
        foreach ($counts as $label => $n) {
            $rows[] = ['optionId' => (string) $label, 'label' => (string) $label, 'requests' => $n];
        }

        // Options stay in the order of the form. Past 10 slices the smallest fold into "Other",
        // together with answers the form no longer offers.
        $other = array_sum($legacy);
        if (count($rows) > 10 || ($legacy !== [] && count($rows) >= 10)) {
            usort($rows, fn ($a, $b) => $b['requests'] <=> $a['requests']);
            $other += array_sum(array_column(array_slice($rows, 9), 'requests'));
            $rows = array_slice($rows, 0, 9);
        }
        if ($other > 0) {
            $rows[] = ['optionId' => '__other', 'label' => 'Other', 'requests' => $other];
        }

        $totalTicks = array_sum(array_column($rows, 'requests'));
        foreach ($rows as &$row) {
            $row['percent'] = $totalTicks > 0 ? (int) round($row['requests'] / $totalTicks * 100) : 0;
        }
        unset($row);

        return [
            'fieldId' => (string) ($field['id'] ?? $field['variable'] ?? ''),
            'label' => (string) ($field['label'] ?? $field['variable'] ?? 'Field'),
            'hint' => (string) ($field['hint'] ?? ''),
            'section' => (string) ($field['section'] ?? ''),
            'sectionHint' => (string) ($field['sectionHint'] ?? ''),
            'totalTicks' => $totalTicks,
            'requestsAnswered' => $answered,
            'options' => $rows,
            'hasLegacy' => $legacy !== [],
        ];
    }

    /** @return array<string, mixed> */
    private function formSummary(Form $f): array
    {
        return [
            '_id' => (string) $f->id,
            'title' => $f->title,
            'formNo' => $f->ref_number,
            'version' => $f->version,
            'office' => (string) ($f->getAttribute('office') ?? ''),
        ];
    }
}
