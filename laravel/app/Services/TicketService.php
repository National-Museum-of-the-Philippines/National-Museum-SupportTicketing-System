<?php

namespace App\Services;

use App\Models\Form;
use App\Models\Ticket;
use App\Models\User;
use App\Support\ActionOfficerWorkflow;
use App\Support\ApiException;
use App\Support\AuthUser;
use App\Support\Id;
use App\Utils\PlacementValues;
use App\Utils\ProfilePlacementFields;
use App\Utils\TicketNumber;

class TicketService
{
    private const ADMIN_STATUS_UPDATES = ['open', 'in_progress', 'pending', 'reopened'];

    public function __construct(
        private FormService $forms,
        private ActivityService $activity,
        private TicketConversationService $ticketConversations,
        private PamanaEmployeeService $pamana,
        private RealtimeService $realtime,
    ) {}

    /**
     * @param  array{answers: array<string, mixed>, attachmentUrl?: string, attachmentName?: string, attachmentMimeType?: string}  $body
     * @return array<string, mixed>
     */
    public function createTicketFromClient(AuthUser $user, string $formId, array $body): array
    {
        $form = $this->forms->getPublishedForm($formId);
        $answers = $body['answers'] ?? [];
        $subject = (string) ($answers['txt_subject'] ?? $answers['subject'] ?? $form['title']);

        $attachmentUrl = $body['attachmentUrl'] ?? null;
        $attachmentMimeType = $body['attachmentMimeType'] ?? null;
        $attachmentName = $body['attachmentName'] ?? null;
        if (
            $attachmentUrl
            && $attachmentMimeType
            && $attachmentMimeType !== 'application/pdf'
            && ! preg_match('/\.pdf$/i', (string) ($attachmentName ?? $attachmentUrl))
        ) {
            throw new ApiException(400, 'Only PDF attachments are allowed');
        }

        $ticketingUser = User::query()->find($user->id);
        $employee = $ticketingUser ? $this->pamana->findForTicketingUser($ticketingUser) : null;
        if ($employee) {
            $profileEmail = $employee['email'] !== ''
                ? $employee['email']
                : (string) ($ticketingUser?->email ?: $user->email);
            $division = trim((string) $employee['division']) !== ''
                ? (string) $employee['division']
                : trim((string) ($ticketingUser?->division ?: $user->division));
            $designation = trim((string) $employee['designation']) !== ''
                ? (string) $employee['designation']
                : trim((string) ($ticketingUser?->designation ?? $user->designation));
            $mergedAnswers = array_merge($answers, ProfilePlacementFields::buildRequesterProfileAnswerValues([
                'name' => $employee['name'],
                'email' => $profileEmail,
                'division' => $division,
                'designation' => $designation,
                'firstName' => $employee['firstName'],
                'middleName' => $employee['middleName'],
                'lastName' => $employee['lastName'],
            ]));
        } else {
            $mergedAnswers = ProfilePlacementFields::mergeRequesterProfileIntoAnswers(
                $this->pamana->requesterProfileFor(
                    $ticketingUser ?? [
                        'name' => $user->name,
                        'email' => $user->email,
                        'division' => $user->division,
                        'designation' => $user->designation,
                    ],
                ),
                $answers,
            );
            // Always keep a login email on the request form even without PAMANA.
            if (trim((string) ($mergedAnswers['{{prof_email}}'] ?? '')) === '') {
                $mergedAnswers['{{prof_email}}'] = (string) ($ticketingUser?->email ?: $user->email);
            }
        }

        $fields = $form['fields'] ?? [];
        $storedAnswers = PlacementValues::normalizeTicketAnswers($fields, $mergedAnswers);

        $requestorDivision = trim((string) ($storedAnswers['{{prof_division}}'] ?? ''));
        if ($requestorDivision === '') {
            $requestorDivision = trim((string) ($employee['division'] ?? ''));
        }
        if ($requestorDivision === '') {
            $requestorDivision = trim((string) ($ticketingUser?->division ?: $user->division));
        }

        $description = collect($fields)->map(function ($field) use ($storedAnswers) {
            $variable = (string) ($field['variable'] ?? '');
            $value = PlacementValues::resolveAnswerForVariable($storedAnswers, $variable);
            $type = (string) ($field['type'] ?? 'textbox');
            if ($value === null || $value === '') {
                $formatted = '—';
            } elseif ($type === 'checkbox') {
                $formatted = ($value === true || $value === 'true') ? 'Yes' : 'No';
            } else {
                $formatted = is_array($value) ? implode(', ', $value) : (string) $value;
            }

            return (($field['label'] ?? $variable).': '.$formatted);
        })->implode("\n");

        $requireRecommending = (bool) ($form['requireRecommendingOfficer'] ?? false);
        $requireSupervisor = (bool) ($form['requireImmediateSupervisor'] ?? false);

        $recommendingOfficerId = null;
        $recommendingOfficerSectionId = null;
        $immediateSupervisorId = null;
        $officer = null;
        $supervisor = null;
        if (($requireRecommending || $requireSupervisor) && $ticketingUser) {
            $routing = $this->pamana->clientApprovalRoutingFor($ticketingUser);
            $recommendingOfficerSectionId = trim((string) ($routing['sectionId'] ?? '')) ?: null;

            if ($requireRecommending) {
                $officer = $routing['recommendingOfficer'] ?? null;
                $recommendingOfficerId = $officer['userId'] ?? null;
            }

            if ($requireSupervisor) {
                $supervisor = $routing['supervisor'] ?? null;
                $immediateSupervisorId = $supervisor['userId'] ?? null;
            }
        }

        if ($requireRecommending || $requireSupervisor) {
            $status = 'for_client_approval';
            $clientApprovalStage = $requireRecommending ? 'recommending' : 'supervisor';
            $processOwnerPhase = null;
            $processOwnerApprovalsDone = 0;
        } else {
            $status = 'for_process_owner';
            $clientApprovalStage = null;
            $processOwnerPhase = ActionOfficerWorkflow::initialPhase(
                ActionOfficerWorkflow::officers(Form::query()->find($formId)),
            );
            $processOwnerApprovalsDone = 0;
        }

        $ticket = Ticket::create([
            'ticket_number' => TicketNumber::generateTicketNumber(),
            'form_id' => $formId,
            'form_title' => $form['title'],
            'title' => $form['title'].' — '.$subject,
            'description' => $description,
            'creator_id' => $user->id,
            'creator_name' => $user->name,
            'creator_email' => $user->email,
            'division' => $requestorDivision,
            'answers' => $storedAnswers,
            'attachment_url' => (string) ($attachmentUrl ?? ''),
            'attachment_name' => (string) ($attachmentName ?? ''),
            'attachment_mime_type' => (string) ($attachmentMimeType ?? ''),
            'status' => $status,
            'client_approval_stage' => $clientApprovalStage,
            'recommending_officer_id' => $recommendingOfficerId,
            'recommending_officer_section_id' => $recommendingOfficerSectionId,
            'immediate_supervisor_id' => $immediateSupervisorId,
            'process_owner_approvals_done' => $processOwnerApprovalsDone,
            'process_owner_phase' => $processOwnerPhase,
            'priority' => 'medium',
            'rejection_reason' => '',
            'feedback_comment' => '',
            'feedback_submitted' => false,
            'client_confirmed' => false,
        ]);

        if ($requireRecommending || $requireSupervisor) {
            $summary = 'Request '.$ticket->ticket_number.' submitted — for client approval';
            if ($requireRecommending) {
                $summary .= isset($officer['name']) && $officer['name'] !== ''
                    ? ' (routed to '.$officer['name'].', Recommending Officer)'
                    : ' (no Recommending Officer assigned for this section — any admin may approve)';
            } elseif ($requireSupervisor) {
                $summary .= $supervisor && $supervisor['name'] !== ''
                    ? ' (routed to '.$supervisor['name'].', Immediate Supervisor)'
                    : ' (no Immediate Supervisor resolved from PAMANA — any admin may approve)';
            }
        } else {
            $summary = 'Request '.$ticket->ticket_number.' submitted — for process owner approval';
        }

        $this->activity->logActivity($user, [
            'action' => 'ticket_created',
            'entityType' => 'ticket',
            'entityId' => (string) $ticket->id,
            'summary' => $summary,
        ]);

        $this->ticketConversations->ensureTicketConversation((string) $ticket->id);
        $this->notifyTicketChange(
            $user,
            $ticket,
            $user->name.' submitted '.$form['title'],
            'ticket.submitted',
        );

        return $ticket->fresh(['assignees'])->toApiArray();
    }

    /**
     * Approval queue and Request Management only list workflow tickets for the
     * Action Officer whose turn it is / the Request Manager. Legacy tickets
     * (forms without a workflow) stay visible to every admin.
     *
     * @param  array{status?: string, search?: string, page?: int, limit?: int, scope?: string}  $query
     * @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, pendingCount: int}
     */
    public function listTicketsForAdmin(AuthUser $user, array $query): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        $limit = min(50, (int) ($query['limit'] ?? 20));
        $builder = Ticket::query()->with(['assignees', 'recommendingOfficer', 'immediateSupervisor']);

        $scope = (string) ($query['scope'] ?? '');
        if (! empty($query['status'])) {
            $status = (string) $query['status'];
            if (in_array($status, ['for_process_owner', 'pending_approval'], true)) {
                $builder->whereIn('status', ['for_process_owner', 'pending_approval']);
                $this->scopeToWorkflowActor($builder, $user);
            } elseif ($status === 'for_client_approval') {
                $builder->where('status', 'for_client_approval');
            } else {
                $builder->where('status', $status);
            }
        }
        if ($scope === 'management') {
            $this->scopeToRequestManager($builder, $user);
        }
        if (! empty($query['search']) && trim($query['search']) !== '') {
            $search = trim($query['search']);
            $builder->where(function ($q) use ($search) {
                $q->where('title', 'like', '%'.$search.'%')
                    ->orWhere('ticket_number', 'like', '%'.$search.'%')
                    ->orWhere('creator_name', 'like', '%'.$search.'%');
            });
        }

        $total = (clone $builder)->count();
        $pendingQuery = Ticket::query()
            ->whereIn('status', ['for_process_owner', 'pending_approval']);
        $this->scopeToWorkflowActor($pendingQuery, $user);
        $pendingCount = $pendingQuery->count();
        $tickets = $builder->orderByDesc('updated_at')
            ->skip(($page - 1) * $limit)
            ->limit($limit)
            ->get();
        $formsById = Form::query()
            ->whereIn('id', $tickets->pluck('form_id')->filter()->unique()->values())
            ->get(['id', 'action_officers'])
            ->keyBy('id');
        $items = $tickets
            ->map(fn (Ticket $t) => $t->toApiArray(
                $this->workflowApiFields($t, ActionOfficerWorkflow::officers($formsById->get($t->form_id))),
            ))
            ->all();

        return compact('items', 'total', 'page', 'limit', 'pendingCount');
    }

    /**
     * Client portal For Review queues (Recommending Officer / Immediate Supervisor).
     *
     * @return array{items: list<array<string, mixed>>, total: int, canReviewRecommending: bool, canReviewSupervisor: bool}
     */
    public function listTicketsForClientReview(AuthUser $user, string $scope): array
    {
        if (! in_array($scope, ['recommending', 'supervisor', 'action_officer'], true)) {
            throw new ApiException(422, 'Invalid review scope');
        }

        if ($scope === 'action_officer') {
            $builder = Ticket::query()->with(['assignees', 'recommendingOfficer', 'immediateSupervisor']);
            $builder->whereIn('status', ['for_process_owner', 'pending_approval']);
            $this->scopeToCurrentActionOfficer($builder, $user);
            $tickets = $builder->orderByDesc('updated_at')->limit(100)->get();
            $formsById = Form::query()
                ->whereIn('id', $tickets->pluck('form_id')->filter()->unique()->values())
                ->get(['id', 'action_officers'])
                ->keyBy('id');
            $items = $tickets
                ->map(fn (Ticket $t) => $t->toApiArray(
                    $this->workflowApiFields($t, ActionOfficerWorkflow::officers($formsById->get($t->form_id))),
                ))
                ->all();

            return [
                'items' => $items,
                'total' => count($items),
                'canReviewRecommending' => false,
                'canReviewSupervisor' => false,
            ];
        }

        $reviewRoles = $this->clientReviewRoles($user);
        $builder = Ticket::query()->with(['assignees', 'recommendingOfficer', 'immediateSupervisor']);
        $this->scopeClientReviewQueue(
            $builder,
            $user,
            $scope,
            $scope === 'recommending'
                ? $reviewRoles['recommendingSectionIds']
                : $reviewRoles['supervisorSectionIds'],
        );

        $tickets = $builder->orderByDesc('updated_at')->limit(100)->get();
        $tickets = $tickets->concat($this->unroutedClientReviewTickets(
            $user,
            $scope,
            $scope === 'recommending'
                ? $reviewRoles['recommendingSectionIds']
                : $reviewRoles['supervisorSectionIds'],
            $tickets->pluck('id')->all(),
        ))->unique('id')->values();
        $formsById = Form::query()
            ->whereIn('id', $tickets->pluck('form_id')->filter()->unique()->values())
            ->get(['id', 'action_officers'])
            ->keyBy('id');
        $items = $tickets
            ->map(fn (Ticket $t) => $t->toApiArray(
                $this->workflowApiFields($t, ActionOfficerWorkflow::officers($formsById->get($t->form_id))),
            ))
            ->all();

        return [
            'items' => $items,
            'total' => count($items),
            'canReviewRecommending' => $reviewRoles['recommendingSectionIds'] !== [],
            'canReviewSupervisor' => $reviewRoles['supervisorSectionIds'] !== [],
        ];
    }

    /**
     * @return array{recommendingSectionIds: list<string>, supervisorSectionIds: list<string>}
     */
    private function clientReviewRoles(AuthUser $actor): array
    {
        $user = User::query()->find($actor->id);
        if (! $user) {
            return ['recommendingSectionIds' => [], 'supervisorSectionIds' => []];
        }

        return $this->pamana->clientReviewRolesFor($user);
    }

    /**
     * @param  list<string>  $sectionIds
     */
    private function scopeClientReviewQueue($builder, AuthUser $user, string $stage, array $sectionIds): void
    {
        $builder->where('status', 'for_client_approval')
            ->where('client_approval_stage', $stage);

        if ($sectionIds === []) {
            $builder->whereRaw('0 = 1');

            return;
        }

        $assignedColumn = $stage === 'recommending'
            ? 'recommending_officer_id'
            : 'immediate_supervisor_id';

        $builder->where(function ($q) use ($user, $sectionIds, $assignedColumn) {
            $q->whereIn('recommending_officer_section_id', $sectionIds)
                ->orWhere($assignedColumn, $user->id);
        });
    }

    private function actorIsClientReviewer(AuthUser $actor, Ticket $ticket): bool
    {
        $stage = (string) ($ticket->client_approval_stage ?? '');
        $roles = $this->clientReviewRoles($actor);
        $sectionIds = $stage === 'recommending'
            ? $roles['recommendingSectionIds']
            : $roles['supervisorSectionIds'];
        if ($sectionIds === []) {
            return false;
        }

        $sectionId = trim((string) ($ticket->recommending_officer_section_id ?? ''));
        if ($sectionId !== '' && in_array($sectionId, $sectionIds, true)) {
            return true;
        }

        $assignedId = $stage === 'recommending'
            ? trim((string) ($ticket->recommending_officer_id ?? ''))
            : trim((string) ($ticket->immediate_supervisor_id ?? ''));

        if ($assignedId === $actor->id) {
            return true;
        }

        $creator = User::query()->find($ticket->creator_id);
        if (! $creator) {
            return false;
        }
        $routing = $this->pamana->clientApprovalRoutingFor($creator);
        $creatorSection = trim((string) ($routing['sectionId'] ?? ''));
        if ($creatorSection !== '' && in_array($creatorSection, $sectionIds, true)) {
            return true;
        }
        $routedOfficerId = $stage === 'recommending'
            ? trim((string) ($routing['recommendingOfficer']['userId'] ?? ''))
            : trim((string) ($routing['supervisor']['userId'] ?? ''));

        return $routedOfficerId === $actor->id;
    }

    /**
     * Tickets submitted before PAMANA staffs.user_id routing was fixed have empty
     * officer columns — still show them if the creator's staff_role maps here.
     *
     * @param  list<string>  $sectionIds
     * @param  list<string>  $alreadyIds
     * @return \Illuminate\Support\Collection<int, Ticket>
     */
    private function unroutedClientReviewTickets(AuthUser $actor, string $stage, array $sectionIds, array $alreadyIds)
    {
        if ($sectionIds === []) {
            return collect();
        }

        $orphans = Ticket::query()
            ->with(['assignees', 'recommendingOfficer', 'immediateSupervisor'])
            ->where('status', 'for_client_approval')
            ->where('client_approval_stage', $stage)
            ->where(function ($q) {
                $q->whereNull('recommending_officer_section_id')
                    ->orWhere('recommending_officer_section_id', '');
            })
            ->when($alreadyIds !== [], fn ($q) => $q->whereNotIn('id', $alreadyIds))
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get();

        return $orphans->filter(function (Ticket $ticket) use ($actor, $stage, $sectionIds) {
            $creator = User::query()->find($ticket->creator_id);
            if (! $creator) {
                return false;
            }
            $routing = $this->pamana->clientApprovalRoutingFor($creator);
            $section = trim((string) ($routing['sectionId'] ?? ''));
            if ($section !== '' && in_array($section, $sectionIds, true)) {
                return true;
            }
            $officerId = $stage === 'recommending'
                ? trim((string) ($routing['recommendingOfficer']['userId'] ?? ''))
                : trim((string) ($routing['supervisor']['userId'] ?? ''));

            return $officerId === $actor->id;
        })->values();
    }

    /** SQL: form has at least one Action Officer configured. */
    private const WORKFLOW_FORM_SQL = "SELECT 1 FROM forms wf WHERE wf.id = tickets.form_id
        AND JSON_TYPE(wf.action_officers) = 'ARRAY' AND JSON_LENGTH(wf.action_officers) > 0";

    /** SQL (inside WORKFLOW_FORM_SQL): userId of the officer whose step it is. */
    private const CURRENT_ACTOR_ID_SQL = "JSON_UNQUOTE(JSON_EXTRACT(wf.action_officers, CONCAT('$[',
        CASE WHEN tickets.process_owner_phase = 'assignment'
                OR tickets.process_owner_approvals_done >= JSON_LENGTH(wf.action_officers)
            THEN JSON_LENGTH(wf.action_officers) - 1
            ELSE tickets.process_owner_approvals_done END,
        '].userId')))";

    /** SQL (inside WORKFLOW_FORM_SQL): userId of the Request Manager (last officer). */
    private const REQUEST_MANAGER_ID_SQL = "JSON_UNQUOTE(JSON_EXTRACT(wf.action_officers,
        CONCAT('$[', JSON_LENGTH(wf.action_officers) - 1, '].userId')))";

    /** Client Action Officer queue: only the officer whose step it is (no legacy all-admins). */
    private function scopeToCurrentActionOfficer($builder, AuthUser $user): void
    {
        $builder->whereRaw('EXISTS ('.self::WORKFLOW_FORM_SQL.' AND '.self::CURRENT_ACTOR_ID_SQL.' = ?)', [$user->id]);
    }

    /**
     * Action Officer approval queue: legacy tickets stay visible to all admins;
     * workflow tickets only to the officer whose turn it is.
     */
    private function scopeToWorkflowActor($builder, AuthUser $user): void
    {
        $builder->where(function ($q) use ($user) {
            $q->whereRaw('NOT EXISTS ('.self::WORKFLOW_FORM_SQL.')')
                ->orWhereRaw('EXISTS ('.self::WORKFLOW_FORM_SQL.' AND '.self::CURRENT_ACTOR_ID_SQL.' = ?)', [$user->id]);
        });
    }

    /** Request Management: after Action Officer approvals, any admin (e.g. Resty) can assign. */
    private function scopeToRequestManager($builder, AuthUser $user): void
    {
        $builder->where(function ($q) {
            $q->whereRaw('NOT EXISTS ('.self::WORKFLOW_FORM_SQL.')')
                ->orWhere(function ($ready) {
                    $ready->whereRaw('EXISTS ('.self::WORKFLOW_FORM_SQL.')')
                        ->where(function ($inner) {
                            $inner->where('tickets.process_owner_phase', 'assignment')
                                ->orWhereNotIn('tickets.status', [
                                    'for_client_approval',
                                    'for_process_owner',
                                    'pending_approval',
                                ]);
                        });
                });
        });
    }

    /**
     * Extra ticket API fields for the Action Officer workflow (no-op for legacy forms).
     *
     * @param  list<array{userId: string, name: string}>  $officers
     * @return array<string, mixed>
     */
    private function workflowApiFields(Ticket $ticket, array $officers): array
    {
        if ($officers === []) {
            return ['actionOfficerWorkflow' => null];
        }

        $fields = ['actionOfficerWorkflow' => ActionOfficerWorkflow::summary($ticket, $officers)];
        if (
            ActionOfficerWorkflow::isInProcessOwnerQueue($ticket)
            && ActionOfficerWorkflow::isReadyForAssignment($ticket, $officers)
        ) {
            $fields['processOwnerPhase'] = 'assignment';
        }

        return $fields;
    }

    /**
     * @param  list<array{userId: string, name: string}>  $officers
     */
    private function assertRequestManager(AuthUser $actor, array $officers, string $action): void
    {
        if (in_array($actor->role, ['admin', 'super_admin'], true)) {
            return;
        }
        $manager = ActionOfficerWorkflow::requestManager($officers);
        if ($manager && $manager['userId'] === $actor->id) {
            return;
        }
        $label = $manager && $manager['name'] !== '' ? $manager['name'].' (Request Management)' : 'Request Management';
        throw new ApiException(403, 'Only '.$label.' can '.$action);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listTicketsForClient(string $userId): array
    {
        return Ticket::query()
            ->with('assignees')
            ->where('creator_id', $userId)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Ticket $t) => $t->toApiArray())
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function getTicketById(string $id): array
    {
        $ticket = Ticket::query()
            ->with([
                'assignees',
                'creator',
                'recommendingOfficer',
                'immediateSupervisor',
                'form' => fn ($q) => $q->select([
                    'id', 'title', 'ref_number', 'fields', 'print_template',
                    'print_template_image_path', 'print_placements', 'print_placement_font_size',
                    'work_procedure_path', 'work_procedure_name', 'action_officers',
                ]),
            ])
            ->find($id);

        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }

        $this->fillMissingRequesterProfileAnswers($ticket);

        return $ticket->toApiArray($this->workflowApiFields($ticket, ActionOfficerWorkflow::officers($ticket->form)));
    }

    /**
     * Older tickets stored empty {{prof_division}} / {{prof_designation}} because
     * the PAMANA staffinformation view was broken. Fill from plantilla + profile.
     */
    private function fillMissingRequesterProfileAnswers(Ticket $ticket): void
    {
        $answers = is_array($ticket->answers) ? $ticket->answers : [];
        $needsDivision = trim((string) ($answers['{{prof_division}}'] ?? '')) === '';
        $needsDesignation = trim((string) ($answers['{{prof_designation}}'] ?? '')) === '';
        if (! $needsDivision && ! $needsDesignation) {
            return;
        }

        $ticket->loadMissing('creator');
        $creator = $ticket->creator;
        $employee = $creator ? $this->pamana->findForTicketingUser($creator) : null;

        $changed = false;
        if ($needsDivision) {
            $division = trim((string) ($employee['division'] ?? ''))
                ?: trim((string) ($ticket->division ?? ''))
                ?: trim((string) ($creator?->division ?? ''));
            if ($division !== '') {
                $answers['{{prof_division}}'] = $division;
                $changed = true;
            }
        }
        if ($needsDesignation) {
            $designation = trim((string) ($employee['designation'] ?? ''))
                ?: trim((string) ($creator?->designation ?? ''));
            if ($designation !== '') {
                $answers['{{prof_designation}}'] = $designation;
                $changed = true;
            }
        }

        if (! $changed) {
            return;
        }

        $ticket->answers = $answers;
        $ticket->save();
    }

    /**
     * @param  array<string, mixed>  $ticket
     */
    public function assertTicketAccess(AuthUser $user, array $ticket): void
    {
        if ($user->role === 'admin') {
            return;
        }

        $creatorId = Id::of($ticket['creatorId'] ?? '');
        if ($creatorId === $user->id) {
            return;
        }

        foreach ($ticket['assignedTo'] ?? [] as $assignee) {
            $assigneeId = is_array($assignee)
                ? Id::of($assignee['_id'] ?? '')
                : Id::of($assignee);
            if ($assigneeId !== '' && $assigneeId === $user->id) {
                return;
            }
        }

        if (($ticket['status'] ?? '') === 'for_client_approval') {
            $model = Ticket::query()->find((string) ($ticket['_id'] ?? ''));
            if ($model && $this->actorIsClientReviewer($user, $model)) {
                return;
            }
        }

        if (in_array((string) ($ticket['status'] ?? ''), ['for_process_owner', 'pending_approval'], true)) {
            $model = Ticket::query()->with('form')->find((string) ($ticket['_id'] ?? ''));
            $officers = $model ? ActionOfficerWorkflow::officers($model->form) : [];
            $current = $model ? ActionOfficerWorkflow::currentActor($model, $officers) : null;
            if ($current && $current['userId'] === $user->id) {
                return;
            }
        }

        throw new ApiException(403, 'You do not have access to this request');
    }

    /**
     * @return array<string, mixed>
     */
    public function approveTicket(AuthUser $actor, string $id): array
    {
        $ticket = Ticket::query()->find($id);
        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }

        if ($ticket->status === 'for_client_approval') {
            return $this->approveClientRequestApproval($actor, $ticket);
        }

        if (! in_array($ticket->status, ['for_process_owner', 'pending_approval'], true)) {
            throw new ApiException(400, 'Ticket is not pending process owner approval');
        }

        return $this->approveProcessOwner($actor, $ticket);
    }

    /**
     * Action Officer approval chain → last officer performs task assignment.
     */
    private function approveProcessOwner(AuthUser $actor, Ticket $ticket): array
    {
        $phase = (string) ($ticket->process_owner_phase ?? 'approval');
        if ($phase === 'assignment') {
            throw new ApiException(400, 'This request is ready for task assignment');
        }

        $form = Form::query()->find($ticket->form_id);
        $officers = ActionOfficerWorkflow::officers($form);
        $doneBefore = (int) ($ticket->process_owner_approvals_done ?? 0);

        if ($officers !== []) {
            // Configured workflow: AO1 → AOn sequential approval; last AO is Request Management.
            $officerCount = count($officers);
            $approvalsNeeded = ActionOfficerWorkflow::approvalsNeeded($officers);
            if (ActionOfficerWorkflow::isReadyForAssignment($ticket, $officers)) {
                throw new ApiException(400, 'This request is ready for task assignment');
            }
            $expected = $officers[$doneBefore] ?? null;
            if (! $expected || $expected['userId'] !== $actor->id) {
                $label = $expected && $expected['name'] !== ''
                    ? $expected['name'].' (Action Officer '.($doneBefore + 1).')'
                    : 'the next Action Officer';
                throw new ApiException(403, 'Only '.$label.' can approve this step');
            }
        } else {
            // Legacy form (no workflow configured): original behavior — admins only.
            if ($actor->role === 'user') {
                throw new ApiException(403, 'Only the assigned Action Officer can approve this request');
            }
            $officerCount = max(1, (int) ($form?->action_officer_count ?? 1));
            $approvalsNeeded = $officerCount === 1 ? 1 : $officerCount - 1;
        }

        $done = $doneBefore + 1;
        $ticket->process_owner_approvals_done = $done;
        $ticket->status = 'for_process_owner';
        $ticket->client_approval_stage = null;

        if ($done >= $approvalsNeeded) {
            $ticket->process_owner_phase = 'assignment';
            $manager = ActionOfficerWorkflow::requestManager($officers);
            $summary = $manager && $manager['name'] !== ''
                ? 'Request '.$ticket->ticket_number.' approved — forwarded to '.$manager['name'].' (Request Management) for task assignment'
                : 'Request '.$ticket->ticket_number.' approved — ready for task assignment';
            $action = 'ticket_process_owner_ready_for_assignment';
        } else {
            $ticket->process_owner_phase = 'approval';
            $summary = 'Request '.$ticket->ticket_number.' approved by Action Officer ('.$done.'/'.$approvalsNeeded.') — awaiting next Action Officer';
            $action = 'ticket_process_owner_approved';
        }

        $ticket->save();

        $this->activity->logActivity($actor, [
            'action' => $action,
            'entityType' => 'ticket',
            'entityId' => (string) $ticket->id,
            'summary' => $summary,
            'meta' => [
                'approvalsDone' => $done,
                'approvalsNeeded' => $approvalsNeeded,
                'actionOfficerCount' => $officerCount,
            ],
        ]);

        $this->ticketConversations->syncTicketConversationParticipants((string) $ticket->id);
        $this->notifyTicketChange($actor, $ticket, $summary);

        return $ticket->fresh(['assignees'])->toApiArray();
    }

    /**
     * Recommending Officer / Immediate Supervisor approval chain.
     */
    private function approveClientRequestApproval(AuthUser $actor, Ticket $ticket): array
    {
        $form = Form::query()->find($ticket->form_id);
        $requireSupervisor = (bool) ($form?->require_immediate_supervisor);
        $stage = (string) ($ticket->client_approval_stage ?? 'recommending');

        if (! $this->actorIsClientReviewer($actor, $ticket)) {
            throw new ApiException(
                403,
                $stage === 'supervisor'
                    ? 'Only an Immediate Supervisor listed in staff_role can approve this request'
                    : 'Only a Recommending Officer listed in staff_role can approve this request',
            );
        }

        if ($stage === 'recommending' && $requireSupervisor) {
            $supervisorId = trim((string) ($ticket->immediate_supervisor_id ?? ''));
            $samePerson = $supervisorId !== '' && ($supervisorId === $actor->id || $supervisorId === trim((string) ($ticket->recommending_officer_id ?? '')));
            if ($supervisorId !== '' && ! $samePerson) {
                $ticket->client_approval_stage = 'supervisor';
                $ticket->status = 'for_client_approval';
                $ticket->save();

                $this->activity->logActivity($actor, [
                    'action' => 'ticket_client_approval_recommending',
                    'entityType' => 'ticket',
                    'entityId' => (string) $ticket->id,
                    'summary' => 'Request '.$ticket->ticket_number.' approved by Recommending Officer — forwarded to Immediate Supervisor',
                ]);

                $this->notifyTicketChange(
                    $actor,
                    $ticket,
                    'Request '.$ticket->ticket_number.' approved by Recommending Officer — forwarded to Immediate Supervisor',
                );

                return $ticket->fresh(['assignees'])->toApiArray();
            }
        }

        $ticket->status = 'for_process_owner';
        $ticket->client_approval_stage = null;
        $ticket->process_owner_approvals_done = 0;
        $ticket->process_owner_phase = ActionOfficerWorkflow::initialPhase(
            ActionOfficerWorkflow::officers($form),
        );
        $ticket->save();

        $this->activity->logActivity($actor, [
            'action' => 'ticket_client_approval_completed',
            'entityType' => 'ticket',
            'entityId' => (string) $ticket->id,
            'summary' => 'Request '.$ticket->ticket_number.' client approvals completed — for process owner',
        ]);

        $this->notifyTicketChange(
            $actor,
            $ticket,
            'Request '.$ticket->ticket_number.' client approvals completed — for process owner',
        );

        return $ticket->fresh(['assignees'])->toApiArray();
    }

    /**
     * @return array<string, mixed>
     */
    public function rejectTicket(AuthUser $actor, string $id, string $reason): array
    {
        $ticket = Ticket::query()->find($id);
        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }
        if (! in_array($ticket->status, ['for_client_approval', 'for_process_owner', 'pending_approval'], true)) {
            throw new ApiException(400, 'Ticket is not awaiting approval');
        }
        if ($ticket->status === 'for_client_approval') {
            if (! $this->actorIsClientReviewer($actor, $ticket)) {
                throw new ApiException(403, 'Only the Recommending Officer or Immediate Supervisor for this request can reject it');
            }
        } else {
            $officers = ActionOfficerWorkflow::officers(Form::query()->find($ticket->form_id));
            $currentActor = ActionOfficerWorkflow::currentActor($ticket, $officers);
            if ($officers === []) {
                if ($actor->role === 'user') {
                    throw new ApiException(403, 'You can only reject requests waiting for your review');
                }
            } elseif (! $currentActor || $currentActor['userId'] !== $actor->id) {
                $label = $currentActor && $currentActor['name'] !== '' ? $currentActor['name'] : 'the assigned Action Officer';
                throw new ApiException(403, 'Only '.$label.' can reject this request at this step');
            }
        }

        $ticket->status = 'rejected';
        $ticket->rejection_reason = $reason;
        $ticket->client_approval_stage = null;
        $ticket->process_owner_approvals_done = 0;
        $ticket->process_owner_phase = null;
        $ticket->save();

        $this->activity->logActivity($actor, [
            'action' => 'ticket_rejected',
            'entityType' => 'ticket',
            'entityId' => (string) $ticket->id,
            'summary' => 'Request '.$ticket->ticket_number.' rejected',
            'meta' => ['reason' => $reason],
        ]);

        $this->notifyTicketChange($actor, $ticket, 'Request '.$ticket->ticket_number.' was rejected');

        return $ticket->fresh(['assignees'])->toApiArray();
    }

    /**
     * @param  list<string>  $assigneeIds
     * @return array<string, mixed>
     */
    public function assignTicket(AuthUser $actor, string $id, array $assigneeIds): array
    {
        $ticket = Ticket::query()->find($id);
        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }
        if ($ticket->status === 'for_client_approval') {
            throw new ApiException(400, 'Complete client approval before assigning personnel');
        }
        $officers = ActionOfficerWorkflow::officers(Form::query()->find($ticket->form_id));
        if ($officers !== []) {
            $this->assertRequestManager($actor, $officers, 'assign personnel for this request');
        }
        if (in_array($ticket->status, ['for_process_owner', 'pending_approval'], true)) {
            $readyForAssignment = $officers !== []
                ? ActionOfficerWorkflow::isReadyForAssignment($ticket, $officers)
                : (string) ($ticket->process_owner_phase ?? '') === 'assignment';
            if (! $readyForAssignment) {
                throw new ApiException(400, 'Complete process owner approvals before assigning personnel');
            }
        }
        if (in_array($ticket->status, ['rejected', 'closed'], true)) {
            throw new ApiException(400, 'Cannot assign personnel to a closed or rejected request');
        }

        $admin = User::query()->find($actor->id);
        $allowedIds = $admin
            ? collect($this->pamana->listStaffInSameSection($admin, false)['users'])->pluck('_id')->all()
            : [];

        $users = User::query()
            ->whereIn('id', $assigneeIds)
            ->where('active', true)
            ->get()
            ->filter(fn (User $u) => in_array((string) $u->id, $allowedIds, true))
            ->values();

        if ($users->isEmpty()) {
            throw new ApiException(400, 'No valid personnel to assign from your section');
        }

        $ids = $users->map(fn (User $u) => (string) $u->id)->all();
        $previousIds = $ticket->assigneeIds();
        $ticket->assignees()->sync($ids);
        if (! in_array($ticket->status, ['resolved', 'closed'], true)) {
            $ticket->status = 'in_progress';
        }
        $ticket->process_owner_phase = null;
        $ticket->save();

        $this->activity->logActivity($actor, [
            'action' => 'ticket_assigned',
            'entityType' => 'ticket',
            'entityId' => (string) $ticket->id,
            'summary' => 'Request '.$ticket->ticket_number.' assigned to '.$users->pluck('name')->implode(', ').' — in progress',
            'meta' => ['assigneeIds' => $ids],
        ]);

        $this->ticketConversations->syncTicketConversationParticipants((string) $ticket->id);
        $this->notifyTicketChange(
            $actor,
            $ticket,
            'Request '.$ticket->ticket_number.' assigned — in progress',
        );
        $this->notifyAssignedPersonnel($actor, $ticket, array_values(array_diff($ids, $previousIds)));

        return $ticket->fresh(['assignees'])->toApiArray();
    }

    /**
     * @return array<string, mixed>
     */
    public function updateTicketStatus(AuthUser $actor, string $id, string $status): array
    {
        if ($status === 'closed') {
            throw new ApiException(403, 'Only the client can close a completed request');
        }
        if (! in_array($status, self::ADMIN_STATUS_UPDATES, true)) {
            throw new ApiException(400, 'Invalid status update');
        }

        $ticket = Ticket::query()->find($id);
        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }
        $officers = ActionOfficerWorkflow::officers(Form::query()->find($ticket->form_id));
        if ($officers !== []) {
            $this->assertRequestManager($actor, $officers, 'update the status of this request');
        }

        $prev = $ticket->status;
        $ticket->status = $status;
        if ($status === 'resolved') {
            $ticket->resolved_at = now();
        }
        $ticket->save();

        $this->activity->logActivity($actor, [
            'action' => 'ticket_status_updated',
            'entityType' => 'ticket',
            'entityId' => (string) $ticket->id,
            'summary' => "Request {$ticket->ticket_number}: {$prev} → {$status}",
        ]);

        $this->notifyTicketChange($actor, $ticket, "Request {$ticket->ticket_number} is now {$status}");

        return $ticket->fresh(['assignees'])->toApiArray();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listTicketsAssignedToAdmin(string $userId): array
    {
        return Ticket::query()
            ->with('assignees')
            ->whereHas('assignees', fn ($q) => $q->where('users_.id', $userId))
            ->whereIn('status', ['open', 'in_progress', 'pending', 'reopened'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Ticket $t) => $t->toApiArray())
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function completeTicketService(AuthUser $actor, string $id): array
    {
        $ticket = Ticket::query()->find($id);
        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }
        if ((string) $ticket->creator_id !== $actor->id) {
            throw new ApiException(403, 'Only the client can mark this service complete');
        }
        if (! in_array($ticket->status, ['open', 'in_progress', 'pending', 'reopened'], true)) {
            throw new ApiException(400, 'This request is not awaiting service completion');
        }

        $ticket->status = 'resolved';
        $ticket->resolved_at = now();
        $ticket->save();

        $this->activity->logActivity($actor, [
            'action' => 'ticket_service_completed',
            'entityType' => 'ticket',
            'entityId' => (string) $ticket->id,
            'summary' => 'Client marked '.$ticket->ticket_number.' complete — feedback pending',
        ]);

        $this->notifyTicketChange($actor, $ticket, 'Client marked '.$ticket->ticket_number.' complete');

        return $ticket->fresh(['assignees'])->toApiArray();
    }

    /**
     * @return array<string, mixed>
     */
    public function clientConfirmResolution(AuthUser $user, string $id, bool $satisfied): array
    {
        $ticket = Ticket::query()->find($id);
        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }
        if ((string) $ticket->creator_id !== $user->id) {
            throw new ApiException(403, 'Not your request');
        }
        if ($ticket->status !== 'resolved') {
            throw new ApiException(400, 'Ticket is not awaiting client action');
        }

        if ($satisfied) {
            if (! $ticket->feedback_submitted) {
                throw new ApiException(400, 'Submit feedback before closing this request');
            }
            $ticket->status = 'closed';
            $ticket->client_confirmed = true;
            $ticket->closed_at = now();
        } else {
            $ticket->status = 'reopened';
            $ticket->client_confirmed = false;
        }
        $ticket->save();

        $this->activity->logActivity($user, [
            'action' => $satisfied ? 'ticket_confirmed' : 'ticket_reopened',
            'entityType' => 'ticket',
            'entityId' => (string) $ticket->id,
            'summary' => $satisfied
                ? 'Client confirmed resolution for '.$ticket->ticket_number
                : 'Client reopened '.$ticket->ticket_number,
        ]);

        $this->ticketConversations->setTicketConversationClosedState((string) $ticket->id, $satisfied);
        $this->notifyTicketChange(
            $user,
            $ticket,
            $satisfied
                ? 'Client confirmed resolution for '.$ticket->ticket_number
                : 'Client reopened '.$ticket->ticket_number,
        );

        return $ticket->fresh(['assignees'])->toApiArray();
    }

    /**
     * @param  array{rating?: int, comment?: string}  $body
     * @return array<string, mixed>
     */
    public function submitFeedback(AuthUser $user, string $id, array $body): array
    {
        $ticket = Ticket::query()->find($id);
        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }
        if ((string) $ticket->creator_id !== $user->id) {
            throw new ApiException(403, 'Not your request');
        }
        if ($ticket->status !== 'resolved') {
            throw new ApiException(400, 'Mark the service complete before submitting feedback');
        }
        if ($ticket->feedback_submitted) {
            throw new ApiException(400, 'Feedback was already submitted for this request');
        }
        if (isset($body['rating']) && ($body['rating'] < 1 || $body['rating'] > 5)) {
            throw new ApiException(400, 'Rating must be 1–5');
        }

        $ticket->feedback_rating = $body['rating'] ?? null;
        $ticket->feedback_comment = trim((string) ($body['comment'] ?? ''));
        $ticket->feedback_submitted = true;
        $ticket->save();

        $this->activity->logActivity($user, [
            'action' => 'feedback_submitted',
            'entityType' => 'ticket',
            'entityId' => (string) $ticket->id,
            'summary' => 'Feedback submitted for '.$ticket->ticket_number.' ('.($body['rating'] ?? '').'/5)',
        ]);

        $this->notifyTicketChange($user, $ticket, 'Feedback submitted for '.$ticket->ticket_number);

        return $ticket->fresh(['assignees'])->toApiArray();
    }

    /**
     * Active personnel in the logged-in admin's PAMANA section (staffinformation.section_id).
     *
     * @return array{users: list<array{_id: string, name: string, email: string, division: string}>, division: string}
     */
    public function listAssignees(AuthUser $actor, ?string $ticketId = null, ?string $division = null): array
    {
        if ($ticketId) {
            $ticket = Ticket::query()->find($ticketId);
            if (! $ticket) {
                throw new ApiException(404, 'Ticket not found');
            }
        }

        $admin = User::query()->find($actor->id);
        if (! $admin) {
            return ['users' => [], 'division' => ''];
        }

        $section = $this->pamana->listStaffInSameSection($admin, false);

        return [
            'users' => $section['users'],
            'division' => $section['sectionName'],
        ];
    }

    private function formOwnerDivisionForTicket(Ticket $ticket): string
    {
        $ticket->loadMissing('form.creator');
        $division = trim((string) ($ticket->form?->creator?->division ?? ''));

        return $division;
    }

    private function divisionsMatch(string $a, string $b): bool
    {
        return mb_strtolower(trim($a)) === mb_strtolower(trim($b));
    }

    /**
     * Direct notice to personnel newly assigned to a request.
     *
     * @param  list<string>  $userIds
     */
    private function notifyAssignedPersonnel(AuthUser $actor, Ticket $ticket, array $userIds): void
    {
        if ($userIds === []) {
            return;
        }

        $assignees = User::query()->whereIn('id', $userIds)->get()->keyBy(fn (User $u) => (string) $u->id);
        $adminIds = [];
        $clientIds = [];
        foreach ($userIds as $id) {
            $role = (string) ($assignees->get($id)?->role ?? 'user');
            if (in_array($role, ['admin', 'super_admin'], true)) {
                $adminIds[] = $id;
            } else {
                $clientIds[] = $id;
            }
        }

        $base = [
            'actorId' => $actor->id,
            'type' => 'ticket.assigned',
            'title' => $ticket->ticket_number,
            'message' => $actor->name.' assigned you to request '.$ticket->ticket_number,
            'ticketId' => (string) $ticket->id,
            'params' => ['ticketId' => (string) $ticket->id],
            'createdAt' => now()->toIso8601String(),
        ];

        if ($adminIds !== []) {
            $this->realtime->emitNotification(
                [...$base, 'audience' => 'admin', 'to' => '/admin/assigned'],
                $adminIds,
            );
        }
        if ($clientIds !== []) {
            $this->realtime->emitNotification(
                [...$base, 'audience' => 'client', 'to' => '/client/assigned'],
                $clientIds,
            );
        }
    }

    /**
     * Push bell/toast updates to admins and the requesting client.
     */
    private function notifyTicketChange(
        AuthUser $actor,
        Ticket $ticket,
        string $message,
        string $type = 'ticket.updated',
    ): void {
        $base = [
            'actorId' => $actor->id,
            'type' => $type,
            'title' => $ticket->ticket_number,
            'message' => $message,
            'ticketId' => (string) $ticket->id,
            'createdAt' => now()->toIso8601String(),
        ];

        $officers = ActionOfficerWorkflow::officers(Form::query()->find($ticket->form_id));
        if ($officers === []) {
            $this->realtime->emitNotification(
                [
                    ...$base,
                    'audience' => 'admin',
                    'to' => '/admin/approvals',
                ],
                [],
                ['admin'],
            );
        } else {
            // Workflow form: only the form's Action Officers hear about it, and the
            // officer whose turn it is gets a direct "action needed" notice.
            $currentActor = ActionOfficerWorkflow::currentActor($ticket, $officers);
            $officerIds = array_column($officers, 'userId');
            $this->realtime->emitNotification(
                [
                    ...$base,
                    'audience' => 'admin',
                    'to' => '/admin/approvals',
                ],
                array_values(array_diff($officerIds, [$currentActor['userId'] ?? ''])),
            );
            if ($currentActor) {
                $isManager = $currentActor['role'] === ActionOfficerWorkflow::ROLE_REQUEST_MANAGER;
                $this->realtime->emitNotification(
                    [
                        ...$base,
                        'type' => 'ticket.workflow_action',
                        'audience' => 'admin',
                        'message' => $isManager
                            ? 'Request '.$ticket->ticket_number.' is ready for Request Management — assign personnel'
                            : 'Request '.$ticket->ticket_number.' is awaiting your approval (Action Officer '.$currentActor['step'].')',
                        'to' => '/admin/requests/$ticketId',
                        'params' => ['ticketId' => (string) $ticket->id],
                    ],
                    [$currentActor['userId']],
                );
            }
        }

        $creatorId = trim((string) $ticket->creator_id);
        if ($creatorId !== '') {
            $this->realtime->emitNotification(
                [
                    ...$base,
                    'audience' => 'client',
                    'to' => '/client/requests/$ticketId',
                    'params' => ['ticketId' => (string) $ticket->id],
                ],
                [$creatorId],
            );
        }
    }
}
