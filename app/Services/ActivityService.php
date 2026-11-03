<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Form;
use App\Models\Ticket;
use App\Support\AuthUser;

class ActivityService
{
    /**
     * @param  array{action: string, entityType: string, entityId: string, summary: string, meta?: array<string, mixed>}  $entry
     */
    public function logActivity(?AuthUser $actor, array $entry): ActivityLog
    {
        return ActivityLog::create([
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->name ?? 'System',
            'action' => $entry['action'],
            'entity_type' => $entry['entityType'],
            'entity_id' => $entry['entityId'],
            'summary' => $entry['summary'],
            'meta' => $entry['meta'] ?? [],
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listRecentActivities(int $limit = 20, ?\DateTimeInterface $since = null, ?string $formOwnerId = null): array
    {
        return ActivityLog::query()
            ->when($formOwnerId, function ($q) use ($formOwnerId) {
                // Only events on this person's forms, or on tickets submitted with those forms.
                $formIds = Form::query()->where('created_by', $formOwnerId)->select('id');
                $q->where(function ($w) use ($formIds) {
                    $w->whereIn('entity_id', $formIds)
                        ->orWhereIn('entity_id', Ticket::query()->whereIn('form_id', $formIds)->select('id'));
                });
            })
            ->when($since, fn ($q) => $q->where('created_at', '>=', $since))
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (ActivityLog $log) => $log->toApiArray())
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listForEntity(string $entityId, int $limit = 50): array
    {
        return ActivityLog::query()
            ->where('entity_id', $entityId)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (ActivityLog $log) => $log->toApiArray())
            ->all();
    }
}
