<?php

namespace App\Models;

use App\Support\Id;
use App\Traits\ApiSerializable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Ticket extends Model
{
    use ApiSerializable {
        toApiArray as protected serializeApiAttributes;
    }

    protected $table = 'tickets';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'ticket_number',
        'form_id',
        'form_title',
        'title',
        'description',
        'creator_id',
        'creator_name',
        'creator_email',
        'division',
        'answers',
        'attachment_url',
        'attachment_name',
        'attachment_mime_type',
        'status',
        'client_approval_stage',
        'recommending_officer_id',
        'recommending_officer_section_id',
        'immediate_supervisor_id',
        'process_owner_approvals_done',
        'process_owner_phase',
        'priority',
        'rejection_reason',
        'feedback_rating',
        'feedback_comment',
        'feedback_submitted',
        'client_confirmed',
        'resolved_at',
        'closed_at',
    ];

    protected $casts = [
        'answers' => 'array',
        'process_owner_approvals_done' => 'integer',
        'feedback_rating' => 'integer',
        'feedback_submitted' => 'boolean',
        'client_confirmed' => 'boolean',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (Ticket $ticket) {
            if (! $ticket->id) {
                $ticket->id = Id::newId();
            }
        });
    }

    public function form(): BelongsTo
    {
        return $this->belongsTo(Form::class, 'form_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function recommendingOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recommending_officer_id');
    }

    public function immediateSupervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'immediate_supervisor_id');
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'ticket_assignees', 'ticket_id', 'user_id');
    }

    /**
     * @return list<string>
     */
    public function assigneeIds(): array
    {
        if ($this->relationLoaded('assignees')) {
            return $this->assignees->map(fn (User $u) => (string) $u->id)->all();
        }

        return $this->assignees()->allRelatedIds()->map(fn ($id) => (string) $id)->values()->all();
    }

    public function toApiArray(array $extra = [], array $hidden = []): array
    {
        $assignedTo = [];
        if ($this->relationLoaded('assignees')) {
            $assignedTo = $this->assignees->map(fn (User $u) => [
                '_id' => (string) $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'division' => $u->division ?? '',
            ])->values()->all();
        } else {
            $assignedTo = $this->assigneeIds();
        }

        $formId = (string) $this->form_id;
        if ($this->relationLoaded('form') && $this->form) {
            $formId = $this->form->toApiArray();
        }

        $creatorId = (string) $this->creator_id;
        if ($this->relationLoaded('creator') && $this->creator) {
            $creatorId = [
                '_id' => (string) $this->creator->id,
                'name' => $this->creator->name,
                'email' => $this->creator->email,
                'division' => $this->creator->division ?? '',
            ];
        }

        $recommendingOfficer = null;
        if ($this->relationLoaded('recommendingOfficer') && $this->recommendingOfficer) {
            $recommendingOfficer = [
                '_id' => (string) $this->recommendingOfficer->id,
                'name' => $this->recommendingOfficer->name,
                'email' => $this->recommendingOfficer->email,
            ];
        } elseif ($this->recommending_officer_id) {
            $recommendingOfficer = (string) $this->recommending_officer_id;
        }

        $immediateSupervisor = null;
        if ($this->relationLoaded('immediateSupervisor') && $this->immediateSupervisor) {
            $immediateSupervisor = [
                '_id' => (string) $this->immediateSupervisor->id,
                'name' => $this->immediateSupervisor->name,
                'email' => $this->immediateSupervisor->email,
            ];
        } elseif ($this->immediate_supervisor_id) {
            $immediateSupervisor = (string) $this->immediate_supervisor_id;
        }

        return $this->serializeApiAttributes(array_merge([
            'assignedTo' => $assignedTo,
            'formId' => $formId,
            'creatorId' => $creatorId,
            'recommendingOfficer' => $recommendingOfficer,
            'immediateSupervisor' => $immediateSupervisor,
        ], $extra), $hidden);
    }
}
