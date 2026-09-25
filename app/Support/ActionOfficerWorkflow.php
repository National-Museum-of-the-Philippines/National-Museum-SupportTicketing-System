<?php

namespace App\Support;

use App\Models\Form;
use App\Models\Ticket;

/**
 * Per-form Action Officer workflow (Form Builder → Workflow step).
 *
 * Officers are ordered AO1..AOn. The last officer is always the Request Manager
 * (Request Management, Assign Personnel, In Progress). All earlier officers are
 * Approval Officers who approve in order. Forms without officers are "legacy"
 * and keep the original any-admin behavior.
 */
final class ActionOfficerWorkflow
{
    public const ROLE_APPROVAL = 'approval';

    public const ROLE_REQUEST_MANAGER = 'request_manager';

    private const PROCESS_OWNER_STATUSES = ['for_process_owner', 'pending_approval'];

    /**
     * @return list<array{userId: string, name: string, email: string, division: string}>
     */
    public static function officers(?Form $form): array
    {
        $raw = $form?->action_officers;
        if (! is_array($raw)) {
            return [];
        }

        $out = [];
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }
            $userId = trim((string) ($row['userId'] ?? ''));
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

        return $out;
    }

    /**
     * @param  list<array{userId: string, name: string}>  $officers
     */
    /**
     * Every Action Officer including the last (Request Management) approves
     * in order. After the last approval, Request Management assigns personnel.
     *
     * @param  list<array{userId: string, name: string}>  $officers
     */
    public static function approvalsNeeded(array $officers): int
    {
        return count($officers);
    }

    /**
     * @param  list<array{userId: string, name: string}>  $officers
     * @return array{userId: string, name: string}|null
     */
    public static function requestManager(array $officers): ?array
    {
        return $officers === [] ? null : $officers[count($officers) - 1];
    }

    public static function isInProcessOwnerQueue(Ticket $ticket): bool
    {
        return in_array((string) $ticket->status, self::PROCESS_OWNER_STATUSES, true);
    }

    /**
     * All Approval Officer steps are done — the Request Manager assigns next.
     *
     * @param  list<array{userId: string, name: string}>  $officers
     */
    public static function isReadyForAssignment(Ticket $ticket, array $officers): bool
    {
        return (string) ($ticket->process_owner_phase ?? '') === 'assignment'
            || (int) ($ticket->process_owner_approvals_done ?? 0) >= self::approvalsNeeded($officers);
    }

    /**
     * Officer who must act now while the ticket is with the process owner.
     *
     * @param  list<array{userId: string, name: string}>  $officers
     * @return array{userId: string, name: string, step: int, role: string}|null
     */
    public static function currentActor(Ticket $ticket, array $officers): ?array
    {
        if ($officers === [] || ! self::isInProcessOwnerQueue($ticket)) {
            return null;
        }

        if (self::isReadyForAssignment($ticket, $officers)) {
            $index = count($officers) - 1;
            $role = self::ROLE_REQUEST_MANAGER;
        } else {
            $index = (int) ($ticket->process_owner_approvals_done ?? 0);
            $role = self::ROLE_APPROVAL;
        }

        $officer = $officers[$index] ?? null;
        if (! $officer) {
            return null;
        }

        return [
            'userId' => $officer['userId'],
            'name' => $officer['name'],
            'step' => $index + 1,
            'role' => $role,
        ];
    }

    /**
     * Phase to start with once a ticket reaches the process owner.
     *
     * @param  list<array{userId: string, name: string}>  $officers
     */
    public static function initialPhase(array $officers): string
    {
        return 'approval';
    }

    /**
     * Viewer-independent workflow summary for the ticket API (null for legacy forms).
     *
     * @param  list<array{userId: string, name: string}>  $officers
     * @return array<string, mixed>|null
     */
    public static function summary(Ticket $ticket, array $officers): ?array
    {
        if ($officers === []) {
            return null;
        }

        $last = count($officers) - 1;

        return [
            'configured' => true,
            'officers' => array_map(fn (array $o, int $i) => [
                'step' => $i + 1,
                'userId' => $o['userId'],
                'name' => $o['name'],
                'role' => $i === $last ? self::ROLE_REQUEST_MANAGER : self::ROLE_APPROVAL,
            ], $officers, array_keys($officers)),
            'approvalsNeeded' => self::approvalsNeeded($officers),
            'approvalsDone' => min((int) ($ticket->process_owner_approvals_done ?? 0), self::approvalsNeeded($officers)),
            'requestManager' => [
                'userId' => $officers[$last]['userId'],
                'name' => $officers[$last]['name'],
            ],
            'currentActor' => self::currentActor($ticket, $officers),
        ];
    }
}
