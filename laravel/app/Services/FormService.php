<?php

namespace App\Services;

use App\Models\Form;
use App\Support\ApiException;
use App\Support\AuthUser;
use App\Utils\FormFields;
use App\Utils\TicketNumber;
use Illuminate\Support\Facades\DB;

class FormService
{
    public function __construct(
        private ActivityService $activity,
        private RealtimeService $realtime,
    ) {}

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function createForm(AuthUser $user, array $body): array
    {
        $body = $this->normalizeFormBody($body);
        $actionOfficers = $this->normalizeActionOfficers($body['actionOfficers'] ?? []);

        $form = Form::create([
            'title' => (string) ($body['title'] ?? ''),
            'ref_number' => (string) ($body['refNumber'] ?? TicketNumber::generateFormRef()),
            'effectivity' => (string) ($body['effectivity'] ?? ''),
            'version' => (string) ($body['version'] ?? 'v1.0'),
            'fields' => $body['fields'] ?? [],
            'signatories' => $body['signatories'] ?? [],
            'print_template' => (string) ($body['printTemplate'] ?? ''),
            'print_template_image_path' => $body['printTemplateImagePath'] ?? null,
            'print_placements' => $body['printPlacements'] ?? [],
            'print_placement_font_size' => (int) ($body['printPlacementFontSize'] ?? 10),
            'work_procedure_name' => (string) ($body['workProcedureName'] ?? ''),
            'work_procedure_path' => $body['workProcedurePath'] ?? null,
            'status' => 'draft',
            'description' => (string) ($body['description'] ?? ''),
            'department' => (string) ($body['department'] ?? ''),
            'require_recommending_officer' => (bool) ($body['requireRecommendingOfficer'] ?? false),
            'require_immediate_supervisor' => (bool) ($body['requireImmediateSupervisor'] ?? false),
            'action_officers' => $actionOfficers,
            'action_officer_count' => max(1, count($actionOfficers) ?: (int) ($body['actionOfficerCount'] ?? 1)),
            'review_remarks' => '',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $this->activity->logActivity($user, [
            'action' => 'form_created',
            'entityType' => 'form',
            'entityId' => (string) $form->id,
            'summary' => 'Form "'.$form->title.'" created as draft',
        ]);

        return $form->toApiArray();
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function updateForm(AuthUser $user, string $formId, array $body): array
    {
        $form = $this->requireForm($formId);
        if (! in_array($form->status, ['draft', 'disapproved'], true)) {
            throw new ApiException(400, 'Only draft or disapproved forms can be edited');
        }

        $body = $this->normalizeFormBody($body);
        $map = [
            'title' => 'title',
            'refNumber' => 'ref_number',
            'effectivity' => 'effectivity',
            'version' => 'version',
            'fields' => 'fields',
            'signatories' => 'signatories',
            'printTemplate' => 'print_template',
            'printTemplateImagePath' => 'print_template_image_path',
            'printPlacements' => 'print_placements',
            'printPlacementFontSize' => 'print_placement_font_size',
            'workProcedureName' => 'work_procedure_name',
            'workProcedurePath' => 'work_procedure_path',
            'description' => 'description',
            'department' => 'department',
            'requireRecommendingOfficer' => 'require_recommending_officer',
            'requireImmediateSupervisor' => 'require_immediate_supervisor',
            'actionOfficerCount' => 'action_officer_count',
            'actionOfficers' => 'action_officers',
        ];

        foreach ($map as $camel => $snake) {
            if (! array_key_exists($camel, $body)) {
                continue;
            }
            $value = $body[$camel];
            if ($snake === 'action_officers') {
                $value = $this->normalizeActionOfficers($value);
                $form->action_officers = $value;
                $form->action_officer_count = max(1, count($value));
                continue;
            }
            if ($snake === 'action_officer_count') {
                // Prefer count derived from actionOfficers when that key is also present.
                if (array_key_exists('actionOfficers', $body)) {
                    continue;
                }
                $value = max(1, (int) $value);
            }
            if (in_array($snake, ['require_recommending_officer', 'require_immediate_supervisor'], true)) {
                $value = (bool) $value;
            }
            $form->{$snake} = $value;
        }
        $form->updated_by = $user->id;
        $form->save();

        return $form->fresh()->toApiArray();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listMyForms(AuthUser $user): array
    {
        return Form::query()
            ->where('created_by', $user->id)
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Form $f) => $f->toApiArray())
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function getFormById(string $id): array
    {
        $form = Form::query()->with('creator')->find($id);
        if (! $form) {
            throw new ApiException(404, 'Form not found');
        }

        return $form->toApiArray();
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function createAndSubmitForReview(AuthUser $user, array $body): array
    {
        $templatePath = trim((string) ($body['printTemplateImagePath'] ?? ''));
        $procedurePath = trim((string) ($body['workProcedurePath'] ?? ''));
        if ($templatePath === '' && $procedurePath === '') {
            throw new ApiException(400, 'Upload a form template before submitting to Records.');
        }

        $form = $this->createForm($user, $body);

        return $this->submitFormForReview($user, (string) $form['_id']);
    }

    /**
     * @return array<string, mixed>
     */
    public function submitFormForReview(AuthUser $user, string $formId): array
    {
        $form = $this->requireForm($formId);
        if (! in_array($form->status, ['draft', 'disapproved'], true)) {
            throw new ApiException(400, 'Only draft or disapproved forms can be submitted for review');
        }

        $form->status = 'pending_review';
        $form->submitted_for_review_at = now();
        $form->review_remarks = '';
        $form->updated_by = $user->id;
        $form->save();

        $this->activity->logActivity($user, [
            'action' => 'form_submitted_for_review',
            'entityType' => 'form',
            'entityId' => (string) $form->id,
            'summary' => 'Form "'.$form->title.'" submitted to Records for review',
        ]);

        $this->realtime->emitNotification(
            [
                'actorId' => $user->id,
                'audience' => 'records',
                'type' => 'form.pending',
                'title' => $form->title,
                'message' => $user->name.' submitted '.$form->title.' for review',
                'to' => '/records/forms/$formId',
                'params' => ['formId' => (string) $form->id],
                'formId' => (string) $form->id,
                'createdAt' => now()->toIso8601String(),
            ],
            [],
            ['record_management'],
        );

        return $form->fresh()->toApiArray();
    }

    /**
     * @param  array{status?: string, search?: string, page?: int, limit?: int}  $query
     * @return array{items: list<array<string, mixed>>, total: int, page: int, limit: int, pendingCount: int}
     */
    public function listFormsForRecords(array $query): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        $limit = min(50, (int) ($query['limit'] ?? 20));

        $builder = Form::query()->with('creator');

        if (! empty($query['status'])) {
            $builder->where('status', $query['status']);
        } else {
            $builder->whereIn('status', ['pending_review', 'published', 'disapproved']);
        }

        if (! empty($query['search']) && trim($query['search']) !== '') {
            $search = trim($query['search']);
            $builder->where(function ($q) use ($search) {
                $q->where('title', 'like', '%'.$search.'%')
                    ->orWhere('department', 'like', '%'.$search.'%');
            });
        }

        $total = (clone $builder)->count();
        $pendingCount = Form::query()->where('status', 'pending_review')->count();
        $items = $builder->orderByDesc('updated_at')
            ->skip(($page - 1) * $limit)
            ->limit($limit)
            ->get()
            ->map(fn (Form $f) => $f->toApiArray())
            ->all();

        return compact('items', 'total', 'page', 'limit', 'pendingCount');
    }

    /**
     * @param  array{decision: string, remarks?: string}  $body
     * @return array<string, mixed>
     */
    public function reviewForm(AuthUser $reviewer, string $formId, array $body): array
    {
        $existing = $this->requireForm($formId);

        if ($existing->status !== 'pending_review') {
            if ($body['decision'] === 'approved' && $existing->status === 'published') {
                return $existing->toApiArray();
            }
            if ($body['decision'] === 'disapproved' && $existing->status === 'disapproved') {
                return $existing->toApiArray();
            }
            $label = str_replace('_', ' ', $existing->status);
            throw new ApiException(400, "This form is already {$label}. Go back to Pending Forms and pick another entry.");
        }

        $nextStatus = $body['decision'] === 'approved' ? 'published' : 'disapproved';
        $reviewRemarks = $body['decision'] === 'approved'
            ? (string) ($body['remarks'] ?? '')
            : (string) ($body['remarks'] ?? 'Please revise and resubmit.');

        $updated = DB::transaction(function () use ($formId, $nextStatus, $reviewRemarks, $reviewer) {
            $affected = Form::query()
                ->where('id', $formId)
                ->where('status', 'pending_review')
                ->update([
                    'status' => $nextStatus,
                    'review_remarks' => $reviewRemarks,
                    'reviewed_by' => $reviewer->id,
                    'reviewed_at' => now(),
                    'updated_by' => $reviewer->id,
                ]);

            if ($affected === 0) {
                return null;
            }

            return Form::query()->find($formId);
        });

        if (! $updated) {
            $current = $this->requireForm($formId);
            if ($body['decision'] === 'approved' && $current->status === 'published') {
                return $current->toApiArray();
            }
            if ($body['decision'] === 'disapproved' && $current->status === 'disapproved') {
                return $current->toApiArray();
            }
            throw new ApiException(400, 'This form was just reviewed by another session. Refresh the list.');
        }

        $this->activity->logActivity($reviewer, [
            'action' => $body['decision'] === 'approved' ? 'form_approved' : 'form_disapproved',
            'entityType' => 'form',
            'entityId' => (string) $updated->id,
            'summary' => 'Form "'.$updated->title.'" '.$body['decision'].' by Records',
            'meta' => ['remarks' => $updated->review_remarks],
        ]);

        $creatorId = trim((string) $updated->created_by);
        $decision = $body['decision'] === 'approved' ? 'published' : 'returned for revision';
        if ($creatorId !== '') {
            $this->realtime->emitNotification(
                [
                    'actorId' => $reviewer->id,
                    'audience' => 'admin',
                    'type' => 'form.reviewed',
                    'title' => $updated->title,
                    'message' => 'Records '.$decision.' '.$updated->title,
                    'to' => '/admin/my-forms',
                    'formId' => (string) $updated->id,
                    'createdAt' => now()->toIso8601String(),
                ],
                [$creatorId],
            );
        }

        $this->realtime->emitNotification(
            [
                'actorId' => $reviewer->id,
                'audience' => 'records',
                'type' => 'form.reviewed',
                'title' => $updated->title,
                'message' => 'Form '.$updated->title.' was '.$decision,
                'to' => '/records/forms/$formId',
                'params' => ['formId' => (string) $updated->id],
                'formId' => (string) $updated->id,
                'createdAt' => now()->toIso8601String(),
            ],
            [],
            ['record_management'],
        );

        return $updated->toApiArray();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listPublishedForms(): array
    {
        return Form::query()
            ->where('status', 'published')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Form $f) => $f->toApiArray())
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function getPublishedForm(string $id): array
    {
        $form = Form::query()->where('id', $id)->where('status', 'published')->first();
        if (! $form) {
            throw new ApiException(404, 'Published form not found');
        }

        return $form->toApiArray();
    }

    private function requireForm(string $id): Form
    {
        $form = Form::query()->find($id);
        if (! $form) {
            throw new ApiException(404, 'Form not found');
        }

        return $form;
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function normalizeFormBody(array $body): array
    {
        if (! isset($body['fields']) || ! is_array($body['fields'])) {
            return $body;
        }
        $body['fields'] = FormFields::normalize($body['fields']);

        return $body;
    }

    /**
     * @return list<array{userId: string, name: string, email: string, division: string}>
     */
    private function normalizeActionOfficers(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $out = [];
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }
            $userId = trim((string) ($row['userId'] ?? $row['_id'] ?? ''));
            if ($userId === '') {
                continue;
            }
            $out[] = [
                'userId' => $userId,
                'name' => trim((string) ($row['name'] ?? '')),
                'email' => trim((string) ($row['email'] ?? '')),
                'division' => trim((string) ($row['division'] ?? '')),
            ];
        }

        return array_values($out);
    }
}
