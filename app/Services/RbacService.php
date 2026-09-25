<?php

namespace App\Services;

use App\Models\OrgUser;
use App\Models\User;
use App\Support\ApiException;
use App\Support\Id;
use Illuminate\Support\Facades\DB;

class RbacService
{
    private const MODEL_TYPES = [
        'App\\Models\\User',
        'App\\Models\\Yii2User',
    ];

    /** Prefer this model_type when writing new assignments. */
    private const WRITE_MODEL_TYPE = 'App\\Models\\User';

    /**
     * @return array{activeEmployees: int, withRoles: int, needsRoleAssignment: int}
     */
    public function summary(): array
    {
        $active = (int) OrgUser::query()->where('is_active', true)->count();

        $withRoles = (int) DB::table('users as u')
            ->where('u.is_active', true)
            ->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('model_has_roles as mhr')
                    ->whereColumn('mhr.model_id', 'u.id')
                    ->whereIn('mhr.model_type', self::MODEL_TYPES);
            })
            ->count();

        return [
            'activeEmployees' => $active,
            'withRoles' => $withRoles,
            'needsRoleAssignment' => max(0, $active - $withRoles),
        ];
    }

    /**
     * @return list<array{id: int, name: string, description: string|null, permissionCount: int, userCount: int, permissionIds: list<int>}>
     */
    public function listRoles(): array
    {
        $roles = DB::table('roles')->orderBy('id')->get(['id', 'name', 'description']);

        $permCounts = DB::table('role_has_permissions')
            ->select('role_id', DB::raw('COUNT(*) as c'))
            ->groupBy('role_id')
            ->pluck('c', 'role_id');

        $userCounts = DB::table('model_has_roles')
            ->whereIn('model_type', self::MODEL_TYPES)
            ->select('role_id', DB::raw('COUNT(DISTINCT model_id) as c'))
            ->groupBy('role_id')
            ->pluck('c', 'role_id');

        $permIdsByRole = [];
        foreach (DB::table('role_has_permissions')->get(['role_id', 'permission_id']) as $row) {
            $rid = (int) $row->role_id;
            $permIdsByRole[$rid][] = (int) $row->permission_id;
        }

        return $roles->map(function ($r) use ($permCounts, $userCounts, $permIdsByRole) {
            $id = (int) $r->id;

            return [
                'id' => $id,
                'name' => (string) $r->name,
                'description' => $r->description !== null ? (string) $r->description : null,
                'permissionCount' => (int) ($permCounts[$id] ?? 0),
                'userCount' => (int) ($userCounts[$id] ?? 0),
                'permissionIds' => $permIdsByRole[$id] ?? [],
            ];
        })->all();
    }

    /**
     * @return list<array{id: int, name: string, description: string|null, category: string|null, roleCount: int}>
     */
    public function listPermissions(): array
    {
        $roleCounts = DB::table('role_has_permissions')
            ->select('permission_id', DB::raw('COUNT(*) as c'))
            ->groupBy('permission_id')
            ->pluck('c', 'permission_id');

        return DB::table('permissions')
            ->orderBy('category')
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'category'])
            ->map(fn ($p) => [
                'id' => (int) $p->id,
                'name' => (string) $p->name,
                'description' => $p->description !== null ? (string) $p->description : null,
                'category' => $p->category !== null ? (string) $p->category : 'General',
                'roleCount' => (int) ($roleCounts[(int) $p->id] ?? 0),
            ])
            ->all();
    }

    /**
     * @return array{id: int, name: string, description: string|null, permissionCount: int, userCount: int, permissionIds: list<int>}
     */
    public function createRole(string $name, ?string $description): array
    {
        $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9_]+/', '_', $name) ?? ''));
        $slug = trim($slug, '_');
        if ($slug === '') {
            throw new ApiException(422, 'Role name is required');
        }

        if (DB::table('roles')->where('name', $slug)->where('guard_name', 'web')->exists()) {
            throw new ApiException(422, 'A role with this name already exists');
        }

        $id = DB::table('roles')->insertGetId([
            'name' => $slug,
            'guard_name' => 'web',
            'description' => $description !== null ? trim($description) : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $this->rolePayload($id);
    }

    /**
     * @return array{id: int, name: string, description: string|null, permissionCount: int, userCount: int, permissionIds: list<int>}
     */
    public function updateRole(int $roleId, ?string $description): array
    {
        $role = DB::table('roles')->where('id', $roleId)->first();
        if (! $role) {
            throw new ApiException(404, 'Role not found');
        }

        DB::table('roles')->where('id', $roleId)->update([
            'description' => $description !== null ? trim($description) : $role->description,
            'updated_at' => now(),
        ]);

        return $this->rolePayload($roleId);
    }

    public function deleteRole(int $roleId): void
    {
        $role = DB::table('roles')->where('id', $roleId)->first();
        if (! $role) {
            throw new ApiException(404, 'Role not found');
        }

        $protected = [
            'super_admin', 'admin', 'record_management', 'user',
        ];
        if (in_array((string) $role->name, $protected, true)) {
            throw new ApiException(400, 'System roles cannot be deleted');
        }

        DB::transaction(function () use ($roleId) {
            DB::table('role_has_permissions')->where('role_id', $roleId)->delete();
            DB::table('model_has_roles')->where('role_id', $roleId)->delete();
            DB::table('roles')->where('id', $roleId)->delete();
        });
    }

    /**
     * Replace permissions for a role.
     *
     * @param  list<int|string>  $permissionIds
     * @return array{id: int, name: string, description: string|null, permissionCount: int, userCount: int, permissionIds: list<int>}
     */
    public function syncRolePermissions(int $roleId, array $permissionIds): array
    {
        $role = DB::table('roles')->where('id', $roleId)->first();
        if (! $role) {
            throw new ApiException(404, 'Role not found');
        }

        $permissionIds = array_values(array_unique(array_map('intval', $permissionIds)));
        $validIds = DB::table('permissions')->whereIn('id', $permissionIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (count($validIds) !== count($permissionIds)) {
            throw new ApiException(422, 'One or more permissions are invalid');
        }

        DB::transaction(function () use ($roleId, $validIds) {
            DB::table('role_has_permissions')->where('role_id', $roleId)->delete();
            foreach ($validIds as $permissionId) {
                DB::table('role_has_permissions')->insert([
                    'role_id' => $roleId,
                    'permission_id' => $permissionId,
                ]);
            }
        });

        return $this->rolePayload($roleId);
    }

    /**
     * @return array{id: int, name: string, description: string|null, permissionCount: int, userCount: int, permissionIds: list<int>}
     */
    private function rolePayload(int $roleId): array
    {
        foreach ($this->listRoles() as $role) {
            if ($role['id'] === $roleId) {
                return $role;
            }
        }

        throw new ApiException(404, 'Role not found');
    }

    /**
     * @param  array{search?: string, role?: string, access?: string, page?: int, perPage?: int}  $filters
     * @return array{items: list<array<string, mixed>>, total: int, page: int, perPage: int, from: int, to: int}
     */
    public function listEmployees(array $filters): array
    {
        $search = trim((string) ($filters['search'] ?? ''));
        $roleFilter = trim((string) ($filters['role'] ?? ''));
        $access = trim((string) ($filters['access'] ?? 'all')); // all | assigned | unassigned
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['perPage'] ?? 20)));

        $base = DB::table('users as u')
            ->where('u.is_active', true);

        if ($search !== '') {
            $like = '%'.mb_strtolower($search).'%';
            $base->where(function ($q) use ($like, $search) {
                $q->whereRaw('LOWER(u.username) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(u.email) LIKE ?', [$like])
                    ->orWhereRaw('CAST(u.id AS CHAR) LIKE ?', ['%'.$search.'%']);
            });
        }

        if ($access === 'assigned') {
            $base->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('model_has_roles as mhr')
                    ->whereColumn('mhr.model_id', 'u.id')
                    ->whereIn('mhr.model_type', self::MODEL_TYPES);
            });
        } elseif ($access === 'unassigned') {
            $base->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('model_has_roles as mhr')
                    ->whereColumn('mhr.model_id', 'u.id')
                    ->whereIn('mhr.model_type', self::MODEL_TYPES);
            });
        }

        if ($roleFilter !== '' && $roleFilter !== 'all') {
            $base->whereExists(function ($q) use ($roleFilter) {
                $q->select(DB::raw(1))
                    ->from('model_has_roles as mhr')
                    ->join('roles as r', 'r.id', '=', 'mhr.role_id')
                    ->whereColumn('mhr.model_id', 'u.id')
                    ->whereIn('mhr.model_type', self::MODEL_TYPES)
                    ->where('r.name', $roleFilter);
            });
        }

        $total = (clone $base)->count();

        $rows = (clone $base)
            ->orderBy('u.username')
            ->forPage($page, $perPage)
            ->get(['u.id', 'u.username', 'u.email']);

        $ids = $rows->pluck('id')->map(fn ($id) => (int) $id)->all();
        $rolesByUser = $this->rolesForUserIds($ids);
        $namesByUser = $this->pamanaNamesForUsernames(
            $rows->pluck('username')->filter()->map(fn ($u) => (string) $u)->all(),
        );

        $items = [];
        foreach ($rows as $row) {
            $id = (int) $row->id;
            $username = (string) ($row->username ?? '');
            $roles = $rolesByUser[$id] ?? [];
            $name = $namesByUser[strtolower($username)] ?? '';
            if ($name === '') {
                $name = $username !== '' ? $username : (string) $row->email;
            }

            $items[] = [
                'id' => $id,
                'name' => $name,
                'email' => (string) $row->email,
                'username' => $username,
                'roles' => $roles,
                'hasRoles' => $roles !== [],
            ];
        }

        // Optional name search against pamana (post-filter current page is weak;
        // re-run with broader match when search looks like a person name).
        if ($search !== '' && str_contains($search, ' ')) {
            // Already filtered by username/email/id; names enriched for display only.
        }

        $from = $total === 0 ? 0 : (($page - 1) * $perPage) + 1;
        $to = min($total, $page * $perPage);

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'from' => $from,
            'to' => $to,
        ];
    }

    /**
     * Replace assigned Spatie roles for an org user and sync ticketing portal role.
     *
     * @param  list<int|string>  $roleIds
     * @return array<string, mixed>
     */
    public function syncRoles(int $orgUserId, array $roleIds): array
    {
        $org = OrgUser::query()->find($orgUserId);
        if (! $org || ! $org->is_active) {
            throw new ApiException(404, 'Employee not found');
        }

        $roleIds = array_values(array_unique(array_map('intval', $roleIds)));
        $validIds = DB::table('roles')->whereIn('id', $roleIds)->pluck('id')->map(fn ($id) => (int) $id)->all();
        if (count($validIds) !== count($roleIds)) {
            throw new ApiException(422, 'One or more roles are invalid');
        }

        DB::transaction(function () use ($orgUserId, $validIds) {
            DB::table('model_has_roles')
                ->where('model_id', $orgUserId)
                ->whereIn('model_type', self::MODEL_TYPES)
                ->delete();

            foreach ($validIds as $roleId) {
                DB::table('model_has_roles')->insert([
                    'role_id' => $roleId,
                    'model_type' => self::WRITE_MODEL_TYPE,
                    'model_id' => $orgUserId,
                ]);
            }
        });

        $org->refresh();
        $this->syncTicketingPortalRole($org);

        $roles = $this->rolesForUserIds([$orgUserId])[$orgUserId] ?? [];
        $name = $this->pamanaNamesForUsernames([(string) $org->username])[strtolower((string) $org->username)]
            ?? ((string) ($org->username ?: $org->email));

        return [
            'id' => (int) $org->id,
            'name' => $name,
            'email' => (string) $org->email,
            'username' => (string) ($org->username ?? ''),
            'roles' => $roles,
            'hasRoles' => $roles !== [],
        ];
    }

    private function syncTicketingPortalRole(OrgUser $org): void
    {
        $email = strtolower((string) $org->email);
        $user = User::query()->where('email', $email)->first();
        $mapped = $org->ticketingRole();

        if (! $user) {
            User::create([
                'id' => Id::newId(),
                'email' => $email,
                'password_hash' => (string) ($org->password ?: ''),
                'name' => $org->displayName(),
                'role' => $mapped,
                'division' => '',
                'designation' => '',
                'active' => true,
            ]);

            return;
        }

        if ($user->role !== 'record_management' || $mapped !== 'user') {
            $user->role = $mapped;
            $user->save();
        }
    }

    /**
     * @param  list<int>  $userIds
     * @return array<int, list<array{id: int, name: string}>>
     */
    private function rolesForUserIds(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        $rows = DB::table('model_has_roles as mhr')
            ->join('roles as r', 'r.id', '=', 'mhr.role_id')
            ->whereIn('mhr.model_id', $userIds)
            ->whereIn('mhr.model_type', self::MODEL_TYPES)
            ->orderBy('r.id')
            ->get(['mhr.model_id', 'r.id as role_id', 'r.name']);

        $map = [];
        foreach ($rows as $row) {
            $uid = (int) $row->model_id;
            $rid = (int) $row->role_id;
            $map[$uid] ??= [];
            // Dedupe across App\Models\User vs Yii2User
            $exists = false;
            foreach ($map[$uid] as $existing) {
                if ($existing['id'] === $rid) {
                    $exists = true;
                    break;
                }
            }
            if (! $exists) {
                $map[$uid][] = [
                    'id' => $rid,
                    'name' => (string) $row->name,
                ];
            }
        }

        return $map;
    }

    /**
     * @param  list<string>  $usernames
     * @return array<string, string> lowercase username => display name
     */
    private function pamanaNamesForUsernames(array $usernames): array
    {
        $usernames = array_values(array_unique(array_filter(array_map('trim', $usernames))));
        if ($usernames === []) {
            return [];
        }

        try {
            $placeholders = implode(',', array_fill(0, count($usernames), '?'));
            $rows = DB::connection('pamana')->select(
                "SELECT LOWER(pu.username) AS username_key,
                        TRIM(CONCAT_WS(' ', si.first_name, NULLIF(si.middle_name, ''), si.last_name)) AS full_name
                 FROM user pu
                 INNER JOIN staffinformation si ON si.user_id = CAST(pu.id AS CHAR)
                 WHERE LOWER(pu.username) IN ({$placeholders})",
                array_map('strtolower', $usernames),
            );
        } catch (\Throwable) {
            return [];
        }

        $map = [];
        foreach ($rows as $row) {
            $key = (string) $row->username_key;
            $name = trim((string) ($row->full_name ?? ''));
            if ($key !== '' && $name !== '') {
                $map[$key] = $name;
            }
        }

        return $map;
    }
}
