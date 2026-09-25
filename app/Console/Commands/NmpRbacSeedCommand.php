<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Upsert Support Ticketing System permissions and ensure system roles have sensible defaults.
 * Keeps existing DMS permissions; adds/updates ticketing ones and role mappings.
 */
class NmpRbacSeedCommand extends Command
{
    protected $signature = 'nmp:rbac-seed {--fresh-ticketing : Re-apply ticketing permission sets on roles (merge)}';

    protected $description = 'Populate roles & permissions from current Support Ticketing System capabilities';

    /** @var list<array{name: string, description: string, category: string}> */
    private const TICKETING_PERMISSIONS = [
        // Forms (Admin Form Builder)
        ['name' => 'view_forms', 'description' => 'View forms in Form Builder / My Forms', 'category' => 'Ticketing Forms'],
        ['name' => 'create_forms', 'description' => 'Create new forms', 'category' => 'Ticketing Forms'],
        ['name' => 'edit_forms', 'description' => 'Edit draft and owned forms', 'category' => 'Ticketing Forms'],
        ['name' => 'submit_forms_review', 'description' => 'Submit forms to Records for review', 'category' => 'Ticketing Forms'],

        // Records portal
        ['name' => 'records_dashboard', 'description' => 'Access Records Management dashboard', 'category' => 'Ticketing Records'],
        ['name' => 'review_forms', 'description' => 'Approve or disapprove forms pending review', 'category' => 'Ticketing Records'],
        ['name' => 'view_records_forms', 'description' => 'Browse pending and published forms in Records', 'category' => 'Ticketing Records'],

        // Tickets / requests
        ['name' => 'view_all_tickets', 'description' => 'View all client requests (admin queue)', 'category' => 'Ticketing Requests'],
        ['name' => 'approve_tickets', 'description' => 'Approve or reject pending client requests', 'category' => 'Ticketing Requests'],
        ['name' => 'assign_tickets', 'description' => 'Assign approved tickets to ICT staff', 'category' => 'Ticketing Requests'],
        ['name' => 'update_ticket_status', 'description' => 'Update ticket workflow status', 'category' => 'Ticketing Requests'],
        ['name' => 'submit_tickets', 'description' => 'Submit technical assistance requests', 'category' => 'Ticketing Requests'],
        ['name' => 'view_own_tickets', 'description' => 'View own submitted requests', 'category' => 'Ticketing Requests'],
        ['name' => 'complete_tickets', 'description' => 'Mark assigned service work complete', 'category' => 'Ticketing Requests'],
        ['name' => 'submit_feedback', 'description' => 'Submit client satisfaction feedback', 'category' => 'Ticketing Requests'],

        // Messaging
        ['name' => 'access_messages', 'description' => 'Access messaging and pokes', 'category' => 'Ticketing Messages'],

        // Admin reports / dashboard
        ['name' => 'view_admin_dashboard', 'description' => 'Access Admin portal dashboard', 'category' => 'Ticketing Admin'],
        ['name' => 'view_admin_reports', 'description' => 'View Admin reports', 'category' => 'Ticketing Admin'],

        // RBAC
        ['name' => 'manage_rbac_users', 'description' => 'Assign roles to employees (RBAC Users)', 'category' => 'Ticketing RBAC'],
        ['name' => 'manage_rbac_roles', 'description' => 'Create and edit roles', 'category' => 'Ticketing RBAC'],
        ['name' => 'manage_rbac_permissions', 'description' => 'Manage role permission matrix', 'category' => 'Ticketing RBAC'],
    ];

    /**
     * Portal / org roles that must exist for the Support Ticketing System.
     *
     * Admin = Section Head (ODG Section & Regional Component Museum) + Division Head (all except ODG).
     * Staff/User merged into `user` (shown as Staff in the UI).
     */
    private const SYSTEM_ROLES = [
        ['name' => 'super_admin', 'description' => 'Super Administrator with full system access'],
        [
            'name' => 'admin',
            'description' => 'Section Head (ODG Section and Regional Component Museum); Division Head (All except ODG)',
        ],
        ['name' => 'record_management', 'description' => 'Record Management — form review & publishing'],
        ['name' => 'user', 'description' => 'Staff / Employee — submit and track own TA requests'],
    ];

    /** Legacy roles retired from System Roles (migrated then deleted). */
    private const RETIRED_ROLES = [
        // Leadership titles collapsed into Admin (Section Head / Division Head)
        'manager' => 'admin',
        'ddga' => 'admin',
        'ddgm' => 'admin',
        'dg' => 'admin',
        'director_ii' => 'admin',
        // Staff merged into User (Staff)
        'staff' => 'user',
    ];

    public function handle(): int
    {
        $now = now();

        foreach (self::SYSTEM_ROLES as $role) {
            $existing = DB::table('roles')->where('name', $role['name'])->where('guard_name', 'web')->first();
            if ($existing) {
                DB::table('roles')->where('id', $existing->id)->update([
                    'description' => $role['description'],
                    'updated_at' => $now,
                ]);
                $this->line("Role OK: {$role['name']}");
            } else {
                DB::table('roles')->insert([
                    'name' => $role['name'],
                    'guard_name' => 'web',
                    'description' => $role['description'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $this->info("Created role: {$role['name']}");
            }
        }

        $this->retireLegacyRoles();

        foreach (self::TICKETING_PERMISSIONS as $perm) {
            $existing = DB::table('permissions')->where('name', $perm['name'])->where('guard_name', 'web')->first();
            if ($existing) {
                DB::table('permissions')->where('id', $existing->id)->update([
                    'description' => $perm['description'],
                    'category' => $perm['category'],
                    'updated_at' => $now,
                ]);
                $this->line("Permission OK: {$perm['name']}");
            } else {
                DB::table('permissions')->insert([
                    'name' => $perm['name'],
                    'guard_name' => 'web',
                    'description' => $perm['description'],
                    'category' => $perm['category'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $this->info("Created permission: {$perm['name']}");
            }
        }

        $this->applyTicketingRoleSets();

        $this->info('RBAC seed complete');

        return self::SUCCESS;
    }

    /**
     * Move assignments from retired roles onto their replacement, then delete the old roles.
     */
    private function retireLegacyRoles(): void
    {
        foreach (self::RETIRED_ROLES as $fromName => $toName) {
            $fromId = DB::table('roles')->where('name', $fromName)->where('guard_name', 'web')->value('id');
            $toId = DB::table('roles')->where('name', $toName)->where('guard_name', 'web')->value('id');
            if (! $fromId) {
                continue;
            }
            if (! $toId) {
                $this->warn("Skip retiring {$fromName}: target role {$toName} missing");
                continue;
            }

            $moved = 0;
            $assignments = DB::table('model_has_roles')->where('role_id', $fromId)->get();
            foreach ($assignments as $row) {
                $already = DB::table('model_has_roles')
                    ->where('role_id', $toId)
                    ->where('model_id', $row->model_id)
                    ->where('model_type', $row->model_type)
                    ->exists();
                if (! $already) {
                    DB::table('model_has_roles')->insert([
                        'role_id' => $toId,
                        'model_id' => $row->model_id,
                        'model_type' => $row->model_type,
                    ]);
                    $moved++;
                }
            }

            DB::table('model_has_roles')->where('role_id', $fromId)->delete();
            DB::table('role_has_permissions')->where('role_id', $fromId)->delete();
            DB::table('roles')->where('id', $fromId)->delete();

            $this->info("Retired role {$fromName} → {$toName} (moved {$moved} assignment(s))");
        }
    }

    private function applyTicketingRoleSets(): void
    {
        $allTicketing = array_column(self::TICKETING_PERMISSIONS, 'name');

        $adminPortal = [
            'view_forms', 'create_forms', 'edit_forms', 'submit_forms_review',
            'view_all_tickets', 'approve_tickets', 'assign_tickets', 'update_ticket_status',
            'submit_tickets', 'view_own_tickets', 'complete_tickets', 'submit_feedback',
            'access_messages',
            'view_admin_dashboard', 'view_admin_reports',
            'manage_rbac_users', 'manage_rbac_roles', 'manage_rbac_permissions',
            // reuse existing where relevant
            'view_users', 'assign_roles', 'manage_roles', 'manage_permissions',
            'view_reports', 'dashboard_access',
        ];

        $recordsPortal = [
            'records_dashboard', 'review_forms', 'view_records_forms', 'view_forms',
            'access_messages',
            'view_documents', 'publish_documents', 'dashboard_access',
        ];

        $clientPortal = [
            'submit_tickets', 'view_own_tickets', 'complete_tickets', 'submit_feedback',
            'access_messages',
        ];

        $sets = [
            'super_admin' => array_values(array_unique(array_merge($allTicketing, [
                'view_users', 'assign_roles', 'manage_roles', 'manage_permissions',
                'manage_settings', 'system_admin', 'view_logs', 'view_reports', 'dashboard_access',
            ]))),
            'admin' => $adminPortal,
            'record_management' => $recordsPortal,
            'user' => $clientPortal,
        ];

        foreach ($sets as $roleName => $permNames) {
            $roleId = DB::table('roles')->where('name', $roleName)->where('guard_name', 'web')->value('id');
            if (! $roleId) {
                continue;
            }

            $permIds = DB::table('permissions')
                ->where('guard_name', 'web')
                ->whereIn('name', $permNames)
                ->pluck('id');

            $added = 0;
            foreach ($permIds as $permissionId) {
                $exists = DB::table('role_has_permissions')
                    ->where('role_id', $roleId)
                    ->where('permission_id', $permissionId)
                    ->exists();
                if (! $exists) {
                    DB::table('role_has_permissions')->insert([
                        'role_id' => $roleId,
                        'permission_id' => $permissionId,
                    ]);
                    $added++;
                }
            }

            $this->info("Role {$roleName}: +{$added} permission(s) (total linked ".DB::table('role_has_permissions')->where('role_id', $roleId)->count().')');
        }
    }
}
