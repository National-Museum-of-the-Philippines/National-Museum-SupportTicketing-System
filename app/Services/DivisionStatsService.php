<?php

namespace App\Services;

use App\Models\Form;
use App\Models\Ticket;
use App\Models\User;
use App\Support\AuthUser;
use App\Utils\FormFields;

class DivisionStatsService
{
    private const CHOICE_TYPES = ['checkbox', 'radio', 'dropdown'];

    /** The Director-General's office and the regional component museums are not part of these statistics. */
    private const EXCLUDED_DIVISION_PATTERN = '/^OFFICE OF THE DIRECTOR-GENERAL$|^OFFICE OF THE DIRECTOR OF .+ NATIONAL MUSEUMS$/i';

    public function __construct(private PamanaEmployeeService $pamana) {}

    /**
     * Closed-ticket counts per form, with a count for every option of each choice field.
     * A form belongs to the PAMANA division of the person who created it. An admin sees
     * their own division; a super admin sees every division.
     *
     * @return array{divisions: list<array<string, mixed>>, myDivision: string, excluded: bool}
     */
    public function forUser(AuthUser $user, ?\DateTimeInterface $since = null): array
    {
        $forms = Form::query()->where('status', 'published')->orderBy('title')->get();

        $divisionByCreator = [];
        foreach ($forms->pluck('created_by')->unique() as $creatorId) {
            $creator = User::query()->find($creatorId);
            $divisionByCreator[$creatorId] = $creator ? $this->unitFor($creator) : '';
        }

        $forms = $forms->reject(fn (Form $f) => preg_match(self::EXCLUDED_DIVISION_PATTERN, trim($divisionByCreator[$f->created_by])) === 1);

        $myDivision = '';
        if ($user->role !== 'super_admin') {
            $mine = User::query()->find($user->id);
            $myDivision = $mine ? $this->unitFor($mine) : '';
            $forms = $forms->filter(fn (Form $f) => $myDivision !== '' && $divisionByCreator[$f->created_by] === $myDivision);
        }

        $tickets = Ticket::query()
            ->whereIn('form_id', $forms->pluck('id')->all())
            ->when($since, fn ($q) => $q->where('created_at', '>=', $since))
            ->get(['form_id', 'status', 'answers', 'created_at'])
            ->groupBy('form_id');

        $divisions = [];
        foreach ($forms as $form) {
            $formTickets = $tickets->get($form->id, collect());
            $closed = $formTickets->where('status', 'closed');
            $division = $divisionByCreator[$form->created_by] ?: 'Unspecified';

            $divisions[$division]['name'] = $division;
            $divisions[$division]['totalRequests'] = ($divisions[$division]['totalRequests'] ?? 0) + $formTickets->count();
            $divisions[$division]['closedRequests'] = ($divisions[$division]['closedRequests'] ?? 0) + $closed->count();
            $divisions[$division]['forms'][] = [
                '_id' => (string) $form->id,
                'title' => $form->title,
                'refNumber' => $form->ref_number,
                'totalRequests' => $formTickets->count(),
                'closedRequests' => $closed->count(),
                'fields' => $this->fieldCounts($form, $closed),
            ];
        }

        // An admin always sees their own division, even before it owns a form.
        $excluded = $myDivision !== '' && preg_match(self::EXCLUDED_DIVISION_PATTERN, $myDivision) === 1;
        if ($myDivision !== '' && ! $excluded && ! isset($divisions[$myDivision])) {
            $divisions[$myDivision] = ['name' => $myDivision, 'totalRequests' => 0, 'closedRequests' => 0, 'forms' => []];
        }

        return ['divisions' => array_values($divisions), 'myDivision' => $myDivision, 'excluded' => $excluded];
    }

    /**
     * PAMANA files sections such as ICT under the Director-General's office. Those sections get
     * their own statistics, so a person under ODG is grouped by their own section instead.
     */
    public function unitFor(User $user): string
    {
        $division = $this->pamana->divisionNameFor($user);
        $section = trim((string) $user->division);
        if (preg_match(self::EXCLUDED_DIVISION_PATTERN, $division) === 1
            && $section !== '' && ! ctype_digit($section)
            && preg_match(self::EXCLUDED_DIVISION_PATTERN, $section) !== 1) {
            return $section;
        }

        return $division;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Ticket>  $closed
     * @return list<array{label: string, options: list<array{name: string, count: int}>}>
     */
    private function fieldCounts(Form $form, $closed): array
    {
        $out = [];
        foreach (FormFields::normalize($form->fields ?? []) as $field) {
            if (! in_array($field['type'] ?? null, self::CHOICE_TYPES, true)) {
                continue;
            }
            $key = $field['variable'] ?? $field['id'] ?? null;
            $options = [];
            foreach ($field['options'] ?? [] as $option) {
                $options[(string) $option] = 0;
            }
            foreach ($closed as $ticket) {
                foreach ((array) (($ticket->answers ?? [])[$key] ?? null) as $picked) {
                    $picked = trim((string) $picked);
                    if ($picked !== '') {
                        $options[$picked] = ($options[$picked] ?? 0) + 1;
                    }
                }
            }
            $out[] = [
                'label' => (string) ($field['label'] ?? $key),
                'options' => array_map(fn ($n, $c) => ['name' => (string) $n, 'count' => $c], array_keys($options), $options),
            ];
        }

        return $out;
    }
}
