<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\Ticket;
use App\Models\User;
use App\Services\ActivityService;
use App\Services\PamanaEmployeeService;
use App\Support\ApiException;
use App\Support\AuthUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SuperAdminController extends Controller
{
    public function __construct(private ActivityService $activity, private PamanaEmployeeService $pamana) {}

    public function overview(Request $request): JsonResponse
    {
        /** @var AuthUser $user */
        $user = $request->attributes->get('authUser');
        if ($user->role !== 'super_admin') {
            throw new ApiException(403, 'Super Admin access required');
        }

        $ticketCounts = Ticket::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $formCounts = Form::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'users' => [
                'total' => User::query()->where('active', true)->count(),
                'superAdmins' => User::query()->where('role', 'super_admin')->where('active', true)->count(),
                'admins' => User::query()->where('role', 'admin')->where('active', true)->count(),
                'records' => User::query()->where('role', 'record_management')->where('active', true)->count(),
                'staff' => User::query()->where('role', 'user')->where('active', true)->count(),
            ],
            'forms' => [
                'draft' => (int) ($formCounts['draft'] ?? 0),
                'pendingReview' => (int) ($formCounts['pending_review'] ?? 0),
                'published' => (int) ($formCounts['published'] ?? 0),
                'disapproved' => (int) ($formCounts['disapproved'] ?? 0),
            ],
            'tickets' => [
                'pendingApproval' => (int) ($ticketCounts['pending_approval'] ?? 0),
                'open' => (int) ($ticketCounts['open'] ?? 0),
                'inProgress' => (int) ($ticketCounts['in_progress'] ?? 0),
                'pending' => (int) ($ticketCounts['pending'] ?? 0),
                'resolved' => (int) ($ticketCounts['resolved'] ?? 0),
                'closed' => (int) ($ticketCounts['closed'] ?? 0),
                'reopened' => (int) ($ticketCounts['reopened'] ?? 0),
                'rejected' => (int) ($ticketCounts['rejected'] ?? 0),
            ],
            'recentActivities' => $this->activity->listRecentActivities(12),
            'insights' => $this->ticketInsights(),
            'incoming' => $this->incomingTickets(),
        ]);
    }

    /** Statuses that still need work; used for the Overdue and Unassigned views. */
    private const OPEN_STATUSES = ['pending_approval', 'for_client_approval', 'for_process_owner', 'pending', 'open', 'in_progress', 'reopened'];

    /**
     * Newest tickets for the dashboard's Incoming panel, plus the tab counts.
     *
     * @return array<string, mixed>
     */
    private function incomingTickets(): array
    {
        $today = now()->startOfDay();
        $latest = Ticket::query()->with('assignees')->orderByDesc('created_at')->limit(7)->get();
        $sections = $this->sectionsByCreator($latest->pluck('creator_id')->filter()->unique()->all());
        $names = $this->sectionNames();

        return [
            'counts' => [
                'all' => Ticket::query()->where('created_at', '>=', $today)->count(),
                'new' => Ticket::query()->where('created_at', '>=', $today)->whereIn('status', ['pending_approval', 'for_client_approval', 'for_process_owner', 'pending', 'open'])->count(),
                'assigned' => Ticket::query()->where('created_at', '>=', $today)->whereHas('assignees')->count(),
                'overdue' => $this->overdueQuery(Ticket::query()->where('created_at', '>=', $today))->count(),
            ],
            'items' => $latest->map(fn (Ticket $t) => $this->ticketRow($t, $names[$sections[$t->creator_id] ?? ''] ?? null))->all(),
        ];
    }

    private function overdueQuery($query)
    {
        return $query->whereIn('status', self::OPEN_STATUSES)
            ->where('created_at', '<', now()->subDays(self::OVERDUE_AFTER_DAYS));
    }

    /** @param  array{name: string, parent: string}|null  $section */
    private function ticketRow(Ticket $t, ?array $section): array
    {
        $overdue = in_array((string) $t->status, self::OPEN_STATUSES, true)
            && $t->created_at && $t->created_at->lt(now()->subDays(self::OVERDUE_AFTER_DAYS));

        return [
            '_id' => (string) $t->id,
            'ticketNumber' => $t->ticket_number,
            'formTitle' => $t->form_title ?: $t->title,
            'status' => (string) $t->status,
            'creatorName' => $t->creator_name,
            'section' => $section['name'] ?? null,
            'assignees' => $t->relationLoaded('assignees') ? $t->assignees->pluck('name')->values()->all() : [],
            'createdAt' => $t->created_at?->toIso8601String(),
            'overdueDays' => $overdue ? (int) $t->created_at->diffInDays(now()) : 0,
        ];
    }

    /**
     * Every ticket from every section, filterable and paginated (Super Admin "All Tickets").
     */
    public function tickets(Request $request): JsonResponse
    {
        /** @var AuthUser $user */
        $user = $request->attributes->get('authUser');
        if ($user->role !== 'super_admin') {
            throw new ApiException(403, 'Super Admin access required');
        }

        $page = max(1, (int) $request->query('page', 1));
        $limit = max(1, min(100, (int) $request->query('limit', 8)));
        $tab = (string) $request->query('tab', 'all');
        $names = $this->sectionNames();

        $base = Ticket::query();
        if (is_string($search = $request->query('search')) && trim($search) !== '') {
            $like = '%'.trim($search).'%';
            $base->where(fn ($q) => $q->where('ticket_number', 'like', $like)
                ->orWhere('creator_name', 'like', $like)
                ->orWhere('form_title', 'like', $like)
                ->orWhere('title', 'like', $like));
        }
        if (is_string($v = $request->query('formTitle')) && $v !== '') {
            $base->where(fn ($q) => $q->where('form_title', $v)->orWhere('title', $v));
        }
        if (is_string($v = $request->query('status')) && $v !== '') {
            $base->where('status', $v);
        }
        if (is_string($v = $request->query('assigneeId')) && $v !== '') {
            $base->whereHas('assignees', fn ($q) => $q->where('users_.id', $v));
        }
        if (is_string($v = $request->query('from')) && $v !== '') {
            $base->where('created_at', '>=', \Illuminate\Support\Carbon::parse($v)->startOfDay());
        }
        if (is_string($v = $request->query('to')) && $v !== '') {
            $base->where('created_at', '<=', \Illuminate\Support\Carbon::parse($v)->endOfDay());
        }
        if (is_string($v = $request->query('sectionId')) && $v !== '') {
            $creatorIds = Ticket::query()->distinct()->pluck('creator_id')->filter()->all();
            $bySection = $this->sectionsByCreator($creatorIds);
            $base->whereIn('creator_id', array_keys(array_filter($bySection, fn ($sid) => $sid === $v)));
        }

        $unassigned = fn ($q) => $q->whereIn('status', self::OPEN_STATUSES)->whereDoesntHave('assignees');
        $counts = [
            'all' => (clone $base)->count(),
            'today' => (clone $base)->where('created_at', '>=', now()->startOfDay())->count(),
            'unassigned' => $unassigned(clone $base)->count(),
            'overdue' => $this->overdueQuery(clone $base)->count(),
            'reopened' => (clone $base)->where('status', 'reopened')->count(),
            'closed' => (clone $base)->where('status', 'closed')->count(),
        ];

        $query = clone $base;
        match ($tab) {
            'today' => $query->where('created_at', '>=', now()->startOfDay()),
            'unassigned' => $unassigned($query),
            'overdue' => $this->overdueQuery($query),
            'reopened' => $query->where('status', 'reopened'),
            'closed' => $query->where('status', 'closed'),
            default => null,
        };

        $total = (clone $query)->count();
        $tickets = $query->with('assignees')->orderByDesc('created_at')->skip(($page - 1) * $limit)->limit($limit)->get();
        $sections = $this->sectionsByCreator($tickets->pluck('creator_id')->filter()->unique()->all());

        $sectionOptions = collect($names)->map(fn ($s, $id) => ['id' => (string) $id, 'name' => $s['name']])->sortBy('name')->values()->all();
        $forms = Ticket::query()->selectRaw('COALESCE(NULLIF(form_title, \'\'), title) as t')->distinct()->orderBy('t')->pluck('t')->filter()->values()->all();
        $staff = User::query()->whereIn('id', DB::table('ticket_assignees')->select('user_id'))->orderBy('name')->get(['id', 'name'])
            ->map(fn ($u) => ['id' => (string) $u->id, 'name' => $u->name])->all();

        return response()->json([
            'items' => $tickets->map(fn (Ticket $t) => $this->ticketRow($t, $names[$sections[$t->creator_id] ?? ''] ?? null))->all(),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'counts' => $counts,
            'filters' => ['sections' => $sectionOptions, 'forms' => $forms, 'staff' => $staff],
        ]);
    }

    /** Open tickets older than this many days count as overdue. */
    private const OVERDUE_AFTER_DAYS = 7;

    private const PENDING = ['pending_approval', 'for_client_approval', 'for_process_owner', 'pending', 'open'];

    private const COMPLETED = ['resolved', 'closed'];

    /**
     * Per-division totals, overdue counts and 8-week trends for the dashboard.
     *
     * @return array<string, mixed>
     */
    private function ticketInsights(): array
    {
        $tickets = Ticket::query()->get(['status', 'creator_id', 'created_at', 'updated_at', 'resolved_at', 'closed_at']);
        $sectionNames = $this->sectionNames();
        $sectionOfCreator = $this->sectionsByCreator($tickets->pluck('creator_id')->filter()->unique()->all());
        $overdueBefore = now()->subDays(self::OVERDUE_AFTER_DAYS);
        $weekAgo = now()->subDays(7);
        $weeks = 8;

        $group = static fn (string $status): string => match (true) {
            in_array($status, self::PENDING, true) => 'pending',
            $status === 'in_progress' => 'inProgress',
            in_array($status, self::COMPLETED, true) => 'completed',
            $status === 'reopened' => 'reopened',
            default => 'other',
        };

        $series = ['pending' => [], 'inProgress' => [], 'completed' => [], 'reopened' => []];
        foreach (array_keys($series) as $key) {
            $series[$key] = array_fill(0, $weeks, 0);
        }
        $thisWeek = ['pending' => 0, 'inProgress' => 0, 'completed' => 0, 'reopened' => 0];
        $divisions = [];
        $overdueTotal = 0;

        foreach ($tickets as $t) {
            $status = (string) $t->status;
            $g = $group($status);
            $isOpen = in_array($g, ['pending', 'inProgress', 'reopened'], true);
            $isOverdue = $isOpen && $t->created_at && $t->created_at->lt($overdueBefore);
            $overdueTotal += $isOverdue ? 1 : 0;

            $sectionId = $sectionOfCreator[$t->creator_id] ?? null;
            $name = $sectionId !== null && isset($sectionNames[$sectionId]) ? $sectionNames[$sectionId]['name'] : 'Unspecified';
            $d = $divisions[$name] ?? ['name' => $name, 'parent' => $sectionNames[$sectionId]['parent'] ?? '', 'total' => 0, 'completed' => 0, 'inProgress' => 0, 'pending' => 0, 'overdue' => 0];
            $d['total']++;
            if (isset($d[$g])) {
                $d[$g]++;
            }
            $d['overdue'] += $isOverdue ? 1 : 0;
            $divisions[$name] = $d;

            if (isset($series[$g])) {
                $when = in_array($g, ['completed', 'reopened'], true) ? $t->updated_at : $t->created_at;
                if ($when) {
                    $weeksAgo = (int) floor($when->diffInDays(now(), false) / 7);
                    if ($weeksAgo >= 0 && $weeksAgo < $weeks) {
                        $series[$g][$weeks - 1 - $weeksAgo]++;
                    }
                    if ($when->gte($weekAgo)) {
                        $thisWeek[$g]++;
                    }
                }
            }
        }

        // Every PAMANA section is listed, including those with no requests yet.
        foreach ($sectionNames as $sec) {
            if (! isset($divisions[$sec['name']])) {
                $divisions[$sec['name']] = ['name' => $sec['name'], 'parent' => $sec['parent'], 'total' => 0, 'completed' => 0, 'inProgress' => 0, 'pending' => 0, 'overdue' => 0];
            }
        }

        // Month-by-month tracker of CLOSED tickets, last 12 months.
        $monthly = [];
        for ($i = 11; $i >= 0; $i--) {
            $m = now()->startOfMonth()->subMonths($i);
            $monthly[$m->format('Y-m')] = ['month' => $m->format('Y-m'), 'label' => $m->format('M Y'), 'closed' => 0, 'days' => 0];
        }
        foreach ($tickets as $t) {
            if ((string) $t->status !== 'closed') {
                continue;
            }
            $closedAt = $t->closed_at ?? $t->updated_at;
            $key = $closedAt?->format('Y-m');
            if ($key !== null && isset($monthly[$key])) {
                $monthly[$key]['closed']++;
                $monthly[$key]['days'] += $t->created_at ? max(0, $t->created_at->diffInDays($closedAt)) : 0;
            }
        }
        foreach ($monthly as &$row) {
            $row['avgDays'] = $row['closed'] > 0 ? round($row['days'] / $row['closed'], 1) : null;
            unset($row['days']);
        }
        unset($row);

        $divisions = array_values($divisions);
        usort($divisions, fn ($a, $b) => $b['total'] <=> $a['total']);

        return [
            'total' => $tickets->count(),
            'overdue' => $overdueTotal,
            'overdueAfterDays' => self::OVERDUE_AFTER_DAYS,
            'trends' => $series,
            'thisWeek' => $thisWeek,
            'divisions' => $divisions,
            'monthly' => array_values($monthly),
        ];
    }

    /**
     * @return array<string, array{name: string, parent: string}> keyed by PAMANA section id
     */
    private function sectionNames(): array
    {
        try {
            $rows = DB::connection('pamana')->table('sections as s')
                ->leftJoin('divisions as d', DB::raw('CONVERT(d.id USING utf8mb4) COLLATE utf8mb4_unicode_ci'), '=', DB::raw('CONVERT(s.divisions_id USING utf8mb4) COLLATE utf8mb4_unicode_ci'))
                ->where(fn ($q) => $q->where('s.deleted', 0)->orWhereNull('s.deleted'))
                ->get(['s.id', 's.section_name', 'd.division_name']);
        } catch (\Throwable) {
            return [];
        }

        $out = [];
        foreach ($rows as $r) {
            $name = trim(preg_replace('/\s+/', ' ', (string) $r->section_name));
            if ($name !== '') {
                $out[(string) $r->id] = ['name' => $name, 'parent' => trim((string) ($r->division_name ?? ''))];
            }
        }

        return $out;
    }

    /**
     * Section id per ticket creator (cached; PAMANA is looked up one person at a time).
     *
     * @param  list<string>  $creatorIds
     * @return array<string, string|null>
     */
    private function sectionsByCreator(array $creatorIds): array
    {
        $out = [];
        foreach ($creatorIds as $id) {
            $out[$id] = Cache::remember('creator-section:'.$id, now()->addMinutes(30), function () use ($id) {
                $user = User::query()->find($id);

                return $user ? ($this->pamana->sectionIdForTicketingUser($user) ?? '') : '';
            }) ?: null;
        }

        return $out;
    }
}
