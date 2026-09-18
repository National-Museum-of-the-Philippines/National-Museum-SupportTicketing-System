<?php

namespace App\Services;

use App\Models\ActivityLog;
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
    public function listRecentActivities(int $limit = 20): array
    {
        return ActivityLog::query()
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(fn (ActivityLog $log) => $log->toApiArray())
            ->all();
    }
}
