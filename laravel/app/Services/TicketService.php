<?php

namespace App\Services;

use App\Models\Form;
use App\Models\Ticket;
use App\Models\User;
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

        if ($requireRecommending || $requireSupervisor) {
            $status = 'for_client_approval';
            $clientApprovalStage = $requireRecommending ? 'recommending' : 'supervisor';
            $processOwnerPhase = null;
            $processOwnerApprovalsDone = 0;
        } else {
            $status = 'for_process_owner';
            $clientApprovalStage = null;
            $processOwnerPhase = 'approval';
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
            'process_owner_approvals_done' => $processOwnerApprovalsDone,
            'process_owner_phase' => $processOwnerPhase,
            'priority' => 'medium',
            'rejection_reason' => '',
            'feedback_comment' => '',
            'feedback_submitted' => false,
            'client_confirmed' => false,
        ]);

        $summary = ($requireRecommending || $requireSupervisor)
            ? 'Request '.$ticket->ticket_number.' submitted — for client approval'
            : 'Request '.$ticket->ticket_number.' submitted — for process owner approval';

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
     * @param  array{status?: string, search?: string, page?: int, limit?: int}  $query
     * @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, pendingCount: int}
     */
    public function listTicketsForAdmin(array $query): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        $limit = min(50, (int) ($query['limit'] ?? 20));
        $builder = Ticket::query()->with('assignees');

        if (! empty($query['status'])) {
            $status = (string) $query['status'];
            if (in_array($status, ['for_process_owner', 'pending_approval', 'for_client_approval'], true)) {
                $builder->whereIn('status', ['for_process_owner', 'pending_approval', 'for_client_approval']);
            } else {
                $builder->where('status', $status);
            }
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
        $pendingCount = Ticket::query()
            ->whereIn('status', ['for_process_owner', 'pending_approval', 'for_client_approval'])
            ->count();
        $items = $builder->orderByDesc('updated_at')
            ->skip(($page - 1) * $limit)
            ->limit($limit)
            ->get()
            ->map(fn (Ticket $t) => $t->toApiArray())
            ->all();

        return compact('items', 'total', 'page', 'limit', 'pendingCount');
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
                'form' => fn ($q) => $q->select([
                    'id', 'title', 'ref_number', 'fields', 'print_template',
                    'print_template_image_path', 'print_placements', 'print_placement_font_size',
                    'work_procedure_path', 'work_procedure_name',
                ]),
            ])
            ->find($id);

        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }

        $this->fillMissingRequesterProfileAnswers($ticket);

        return $ticket->toApiArray();
    }

    /**
     * Older tickets stored empty {{prof_division}} / {{prof_designation}} because
     * the PAMANA staffinformations view was broken. Fill from plantilla + profile.
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
        if ($user->role === 'user' && $creatorId === $user->id) {
            return;
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
        $officerCount = max(1, (int) ($form?->action_officer_count ?? 1));
        $officers = is_array($form?->action_officers) ? $form->action_officers : [];
        if (count($officers) > 0) {
            $officerCount = count($officers);
        }
        $approvalsNeeded = $officerCount === 1 ? 1 : $officerCount - 1;

        $doneBefore = (int) ($ticket->process_owner_approvals_done ?? 0);
        if (count($officers) > 0) {
            $expected = $officers[$doneBefore] ?? null;
            $expectedId = is_array($expected) ? trim((string) ($expected['userId'] ?? '')) : '';
            if ($expectedId === '' || $expectedId !== $actor->id) {
                $label = is_array($expected) && ($expected['name'] ?? '') !== ''
                    ? (string) $expected['name']
                    : 'the next Action Officer';
                throw new ApiException(403, 'Only '.$label.' can approve this step');
            }
        }

        $done = $doneBefore + 1;
        $ticket->process_owner_approvals_done = $done;
        $ticket->status = 'for_process_owner';
        $ticket->client_approval_stage = null;

        if ($done >= $approvalsNeeded) {
            $ticket->process_owner_phase = 'assignment';
            $summary = 'Request '.$ticket->ticket_number.' approved — ready for task assignment';
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

        if ($stage === 'recommending' && $requireSupervisor) {
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

        $ticket->status = 'for_process_owner';
        $ticket->client_approval_stage = null;
        $ticket->process_owner_approvals_done = 0;
        $ticket->process_owner_phase = 'approval';
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
        if (in_array($ticket->status, ['for_process_owner', 'pending_approval'], true)) {
            if ((string) ($ticket->process_owner_phase ?? '') !== 'assignment') {
                throw new ApiException(400, 'Complete process owner approvals before assigning personnel');
            }
            $form = Form::query()->find($ticket->form_id);
            $officers = is_array($form?->action_officers) ? $form->action_officers : [];
            if (count($officers) > 0) {
                $last = $officers[count($officers) - 1];
                $expectedId = is_array($last) ? trim((string) ($last['userId'] ?? '')) : '';
                if ($expectedId === '' || $expectedId !== $actor->id) {
                    $label = is_array($last) && ($last['name'] ?? '') !== ''
                        ? (string) $last['name']
                        : 'the assigned Action Officer';
                    throw new ApiException(403, 'Only '.$label.' can assign personnel for this request');
                }
            }
        }
        if (in_array($ticket->status, ['rejected', 'closed'], true)) {
            throw new ApiException(400, 'Cannot assign personnel to a closed or rejected request');
        }

        $users = User::query()
            ->whereIn('id', $assigneeIds)
            ->where('role', 'admin')
            ->where('active', true)
            ->get();

        if ($users->isEmpty()) {
            throw new ApiException(400, 'No valid personnel to assign');
        }

        $ownerDivision = $this->formOwnerDivisionForTicket($ticket);
        if ($ownerDivision !== '') {
            $outside = $users->filter(
                fn (User $u) => ! $this->divisionsMatch((string) ($u->division ?? ''), $ownerDivision),
            );
            if ($outside->isNotEmpty()) {
                throw new ApiException(
                    400,
                    'Personnel must belong to the form owner\'s division ('.$ownerDivision.')',
                );
            }
        }

        $ids = $users->map(fn (User $u) => (string) $u->id)->all();
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
     * Active admin users available for assignment / Action Officer selection.
     * When $ticketId is set, only admins from the form creator's division are returned.
     * When $division is set (form builder), filter by that section/division.
     *
     * @return array{users: list<array{_id: string, name: string, email: string, division: string}>, division: string}
     */
    public function listAssignees(?string $ticketId = null, ?string $division = null): array
    {
        $query = User::query()
            ->where('role', 'admin')
            ->where('active', true);

        $ownerDivision = '';
        if ($ticketId) {
            $ticket = Ticket::query()->find($ticketId);
            if (! $ticket) {
                throw new ApiException(404, 'Ticket not found');
            }
            $ownerDivision = $this->formOwnerDivisionForTicket($ticket);
            if ($ownerDivision !== '') {
                $query->whereRaw('LOWER(TRIM(division)) = ?', [mb_strtolower($ownerDivision)]);
            }
        } elseif ($division !== null && trim($division) !== '') {
            $ownerDivision = trim($division);
            $query->whereRaw('LOWER(TRIM(division)) = ?', [mb_strtolower($ownerDivision)]);
        }

        $users = $query
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => [
                '_id' => (string) $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'division' => $u->division ?? '',
            ])
            ->all();

        return [
            'users' => $users,
            'division' => $ownerDivision,
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

        $this->realtime->emitNotification(
            [
                ...$base,
                'audience' => 'admin',
                'to' => '/admin/approvals',
            ],
            [],
            ['admin'],
        );

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
