<?php

namespace App\Services;

use App\Models\OrgUser;
use App\Models\User;
use App\Support\Id;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Requester profile from pamana_employees_new for TA form auto-fill.
 *
 *  {{prof_division}}    = plantilla/staff_role section_id → sections.section_name
 *  {{prof_first}}       = staffs.first_name
 *  {{prof_middle}}      = staffs.middle_name
 *  {{prof_last}}        = staffs.last_name
 *  {{prof_email}}       = staffs.secondary_email ?? staffs.email
 *  {{prof_designation}} = item_numbers → positions.position_name
 *
 * The MySQL views `staffinformation` / `staffinformations` are broken (SELECT 1 AS …)
 * so profile fields are read from staffs, staff_appointment, item_numbers, positions,
 * sections, and staff_role.
 */
class PamanaEmployeeService
{
    /**
     * @return array{
     *   firstName: string,
     *   middleName: string,
     *   lastName: string,
     *   email: string,
     *   division: string,
     *   sectionId: string,
     *   designation: string,
     *   name: string
     * }|null
     */
    public function findForTicketingUser(User $user): ?array
    {
        $email = strtolower(trim((string) $user->email));
        $org = OrgUser::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        // Fallback: museum logins sometimes store a different email than users_.email
        // but share the username local-part (e.g. resty.morancil).
        if (! $org && str_contains($email, '@')) {
            $local = strstr($email, '@', true) ?: '';
            if ($local !== '') {
                $org = OrgUser::query()
                    ->whereRaw('LOWER(username) = ?', [strtolower($local)])
                    ->first();
            }
        }

        if ($org) {
            $hit = $this->findForOrgUser($org);
            if ($hit) {
                if ($hit['email'] === '') {
                    $hit['email'] = (string) ($org->email ?: $user->email);
                }

                return $hit;
            }
        }

        $byEmail = $this->lookupByEmailOnly($email);
        if ($byEmail && $byEmail['email'] === '') {
            $byEmail['email'] = (string) $user->email;
        }

        return $byEmail;
    }

    /**
     * @return array{
     *   firstName: string,
     *   middleName: string,
     *   lastName: string,
     *   email: string,
     *   division: string,
     *   sectionId: string,
     *   designation: string,
     *   name: string
     * }|null
     */
    public function findForOrgUser(OrgUser $org): ?array
    {
        // Primary link: nmp_ticketing.users.id === pamana staffs.user_id
        // (most employees are not in the small pamana `user` login table).
        $hit = $this->loadByStaffUserId((string) $org->id);
        if ($hit) {
            return $this->withLoginEmailFallback($hit, (string) $org->email);
        }

        $pamanaUserId = $this->resolvePamanaUserId($org);
        if ($pamanaUserId !== null && $pamanaUserId !== (string) $org->id) {
            $hit = $this->loadByStaffUserId($pamanaUserId);
            if ($hit) {
                return $this->withLoginEmailFallback($hit, (string) $org->email);
            }
        }

        $byEmail = $this->lookupByEmailOnly((string) $org->email);

        return $byEmail ? $this->withLoginEmailFallback($byEmail, (string) $org->email) : null;
    }

    /**
     * @param  array{
     *   firstName: string,
     *   middleName: string,
     *   lastName: string,
     *   email: string,
     *   division: string,
     *   sectionId: string,
     *   designation: string,
     *   name: string
     * }  $employee
     * @return array{
     *   firstName: string,
     *   middleName: string,
     *   lastName: string,
     *   email: string,
     *   division: string,
     *   sectionId: string,
     *   designation: string,
     *   name: string
     * }
     */
    private function withLoginEmailFallback(array $employee, string $loginEmail): array
    {
        if ($employee['email'] === '' && trim($loginEmail) !== '') {
            $employee['email'] = trim($loginEmail);
        }

        return $employee;
    }

    /**
     * @return array{
     *   firstName: string,
     *   middleName: string,
     *   lastName: string,
     *   email: string,
     *   division: string,
     *   sectionId: string,
     *   designation: string,
     *   name: string
     * }|null
     */
    public function findByUsernameOrEmail(string $username, string $email): ?array
    {
        $username = trim($username);
        $email = strtolower(trim($email));

        if ($username !== '') {
            try {
                $pu = DB::connection('pamana')->selectOne(
                    'SELECT id FROM `user` WHERE LOWER(username) = ? LIMIT 1',
                    [strtolower($username)],
                );
                if ($pu) {
                    $hit = $this->loadByStaffUserId((string) $pu->id);
                    if ($hit) {
                        return $hit;
                    }
                }
            } catch (Throwable $e) {
                Log::warning('Pamana username lookup failed', ['error' => $e->getMessage()]);
            }
        }

        return $this->lookupByEmailOnly($email);
    }

    /**
     * Resolve PAMANA staffs.user_id for an org login account.
     * Prefer username identity — never bind seed/demo org ids to unrelated staff rows.
     */
    private function resolvePamanaUserId(OrgUser $org): ?string
    {
        $orgId = (string) $org->id;
        $username = strtolower(trim((string) ($org->username ?? '')));
        $email = strtolower(trim((string) $org->email));

        try {
            if ($username !== '') {
                $byUsername = DB::connection('pamana')->selectOne(
                    'SELECT id FROM `user` WHERE LOWER(username) = ? LIMIT 1',
                    [$username],
                );
                if ($byUsername) {
                    return (string) $byUsername->id;
                }
            }

            if ($email !== '') {
                $byEmail = DB::connection('pamana')->selectOne(
                    'SELECT id FROM `user` WHERE LOWER(email) = ? LIMIT 1',
                    [$email],
                );
                if ($byEmail) {
                    return (string) $byEmail->id;
                }
            }

            // Same numeric id only when PAMANA username matches org username (true shared identity).
            if ($username !== '') {
                $byId = DB::connection('pamana')->selectOne(
                    'SELECT id FROM `user` WHERE id = ? AND LOWER(username) = ? LIMIT 1',
                    [$orgId, $username],
                );
                if ($byId) {
                    return (string) $byId->id;
                }
            }
        } catch (Throwable $e) {
            Log::warning('Pamana resolve user id failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * @return array{
     *   firstName: string,
     *   middleName: string,
     *   lastName: string,
     *   email: string,
     *   division: string,
     *   sectionId: string,
     *   designation: string,
     *   name: string
     * }|null
     */
    private function loadByStaffUserId(string $staffUserId): ?array
    {
        try {
            $row = DB::connection('pamana')->selectOne(
                $this->staffProfileSelectSql().'
                 WHERE st.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
                   AND (st.deleted = 0 OR st.deleted IS NULL)
                 '.$this->staffProfileOrderSql().'
                 LIMIT 1',
                [$staffUserId],
            );
        } catch (Throwable $e) {
            Log::warning('Pamana loadByStaffUserId failed', [
                'staffUserId' => $staffUserId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        return $this->mapRow($row);
    }

    /**
     * @return array{
     *   firstName: string,
     *   middleName: string,
     *   lastName: string,
     *   email: string,
     *   division: string,
     *   sectionId: string,
     *   designation: string,
     *   name: string
     * }|null
     */
    private function lookupByEmailOnly(string $email): ?array
    {
        $email = strtolower(trim($email));
        if ($email === '') {
            return null;
        }

        // Ignore shared placeholder emails that many staff rows share.
        if ($this->isSharedPlaceholderEmail($email)) {
            return null;
        }

        try {
            $row = DB::connection('pamana')->selectOne(
                $this->staffProfileSelectSql().'
                 WHERE (st.deleted = 0 OR st.deleted IS NULL)
                   AND (
                        LOWER(COALESCE(st.email, \'\')) = ?
                        OR LOWER(COALESCE(st.secondary_email, \'\')) = ?
                   )
                 '.$this->staffProfileOrderSql().'
                 LIMIT 1',
                [$email, $email],
            );
        } catch (Throwable $e) {
            Log::warning('Pamana email lookup failed', ['error' => $e->getMessage()]);

            return null;
        }

        return $this->mapRow($row);
    }

    private function staffProfileSelectSql(): string
    {
        return "SELECT
                    TRIM(st.first_name) AS first_name,
                    TRIM(st.middle_name) AS middle_name,
                    TRIM(st.last_name) AS last_name,
                    COALESCE(
                        NULLIF(TRIM(it.sections_id), ''),
                        NULLIF(TRIM(sr.section_id), '')
                    ) AS section_id,
                    COALESCE(
                        NULLIF(TRIM(sec_item.section_name), ''),
                        NULLIF(TRIM(sec_role.section_name), '')
                    ) AS section_name,
                    COALESCE(
                        NULLIF(TRIM(p.position_name), ''),
                        NULLIF(TRIM(sr.designation), ''),
                        NULLIF(TRIM(ah.designation), '')
                    ) AS position,
                    st.email AS staff_email,
                    st.secondary_email
                 FROM staffs st
                 LEFT JOIN staff_appointment sa
                    ON CAST(sa.user_id AS CHAR) COLLATE utf8mb4_unicode_ci
                     = st.user_id COLLATE utf8mb4_unicode_ci
                   AND (sa.deleted = 0 OR sa.deleted IS NULL)
                 LEFT JOIN item_numbers it
                    ON it.id COLLATE utf8mb4_unicode_ci = sa.item_number_id COLLATE utf8mb4_unicode_ci
                 LEFT JOIN sections sec_item
                    ON sec_item.id COLLATE utf8mb4_unicode_ci = it.sections_id COLLATE utf8mb4_unicode_ci
                 LEFT JOIN positions p
                    ON p.id COLLATE utf8mb4_unicode_ci = it.positions_id COLLATE utf8mb4_unicode_ci
                 LEFT JOIN staff_role sr
                    ON CAST(sr.user_id AS CHAR) COLLATE utf8mb4_unicode_ci
                     = st.user_id COLLATE utf8mb4_unicode_ci
                   AND (sr.deleted = 0 OR sr.deleted IS NULL)
                 LEFT JOIN sections sec_role
                    ON sec_role.id COLLATE utf8mb4_unicode_ci = sr.section_id COLLATE utf8mb4_unicode_ci
                 LEFT JOIN appointment_history_new ah
                    ON ah.user_id = CAST(st.user_id AS UNSIGNED)
                   AND (ah.deleted = 0 OR ah.deleted IS NULL)
                   AND UPPER(TRIM(ah.inclusive_to)) = 'PRESENT'";
    }

    private function staffProfileOrderSql(): string
    {
        return 'ORDER BY sa.updated_at DESC, sr.updated_at DESC, st.updated_at DESC';
    }

    private function isSharedPlaceholderEmail(string $email): bool
    {
        $email = strtolower(trim($email));

        return str_contains($email, 'dextercellonabanawon')
            || str_contains($email, 'harvey.alonday');
    }

    /**
     * @param  object|null  $row
     * @return array{
     *   firstName: string,
     *   middleName: string,
     *   lastName: string,
     *   email: string,
     *   division: string,
     *   sectionId: string,
     *   designation: string,
     *   name: string
     * }|null
     */
    private function mapRow(?object $row): ?array
    {
        if (! $row) {
            return null;
        }

        $first = trim((string) ($row->first_name ?? ''));
        $middle = trim((string) ($row->middle_name ?? ''));
        $last = trim((string) ($row->last_name ?? ''));
        $sectionId = trim((string) ($row->section_id ?? ''));
        $sectionName = trim((string) ($row->section_name ?? ''));
        $secondary = trim((string) ($row->secondary_email ?? ''));
        $primary = trim((string) ($row->staff_email ?? ''));
        $profileEmail = $secondary !== '' ? $secondary : $primary;
        // Shared placeholder inbox used by many PAMANA rows — never treat as the employee's email.
        if ($profileEmail !== '' && $this->isSharedPlaceholderEmail($profileEmail)) {
            $profileEmail = '';
        }

        if ($first === '' && $last === '' && $sectionId === '' && $sectionName === '') {
            return null;
        }

        // Division/Section on TA form: section name from staffinformations (via section_id).
        $division = $sectionName !== '' ? $sectionName : $sectionId;

        // Middle Initial box on Support Ticketing System forms: first letter of middle_name.
        $middleInitial = $middle !== '' ? mb_strtoupper(mb_substr($middle, 0, 1)) : '';

        $nameParts = array_values(array_filter([$first, $middle, $last], fn ($p) => $p !== ''));

        return [
            'firstName' => $first,
            'middleName' => $middleInitial,
            'lastName' => $last,
            'email' => $profileEmail,
            'division' => $division,
            'sectionId' => $sectionId,
            'designation' => trim((string) ($row->position ?? '')),
            'name' => implode(' ', $nameParts),
        ];
    }

    /**
     * @param  array{firstName: string, middleName: string, lastName: string, email: string, division: string, sectionId?: string, designation: string, name: string}|null  $employee
     */
    public function enrichPublicUser(User $user, ?array $employee = null): array
    {
        $base = $user->toPublicUser();
        $employee ??= $this->findForTicketingUser($user);

        if (! $employee) {
            return [
                ...$base,
                'firstName' => '',
                'middleName' => '',
                'lastName' => '',
            ];
        }

        return [
            'id' => $base['id'],
            'email' => $base['email'],
            'name' => $employee['name'] !== '' ? $employee['name'] : $base['name'],
            'role' => $base['role'],
            'division' => $employee['division'] !== '' ? $employee['division'] : $base['division'],
            'designation' => $employee['designation'] !== '' ? $employee['designation'] : ($base['designation'] ?? ''),
            'firstName' => $employee['firstName'],
            'middleName' => $employee['middleName'],
            'lastName' => $employee['lastName'],
        ];
    }

    /**
     * @param  User|array<string, mixed>  $user
     * @return array{name: string, email: string, division: string, designation: string, firstName: string, middleName: string, lastName: string}
     */
    public function requesterProfileFor(User|array $user): array
    {
        $public = is_array($user) ? $user : $this->enrichPublicUser($user);

        return [
            'name' => (string) ($public['name'] ?? ''),
            'email' => (string) ($public['email'] ?? ''),
            'division' => (string) ($public['division'] ?? ''),
            'designation' => (string) ($public['designation'] ?? ''),
            'firstName' => (string) ($public['firstName'] ?? ''),
            'middleName' => (string) ($public['middleName'] ?? ''),
            'lastName' => (string) ($public['lastName'] ?? ''),
        ];
    }

    /**
     * @param  array{firstName: string, middleName: string, lastName: string, email: string, division: string, sectionId?: string, designation: string, name: string}|null  $employee
     */
    public function syncTicketingUser(User $user, ?array $employee = null): User
    {
        $employee ??= $this->findForTicketingUser($user);
        if (! $employee) {
            return $user;
        }

        if ($employee['name'] !== '') {
            $user->name = $employee['name'];
        }
        if ($employee['division'] !== '') {
            $user->division = $employee['division'];
        }
        if ($employee['designation'] !== '') {
            $user->designation = $employee['designation'];
        }
        $user->save();

        return $user;
    }

    /**
     * Action Officer dropdown: staff in the form creator's PAMANA section
     * (staffinformations.section_id / staff_role + item_numbers) whose
     * appointment status is Active.
     *
     * @return array{users: list<array{_id: string, name: string, email: string, division: string}>, sectionId: string, sectionName: string}
     */
    public function listActionOfficersForCreator(User $creator): array
    {
        $pamanaUserId = $this->pamanaStaffUserIdForTicketingUser($creator);
        $sectionId = $pamanaUserId !== null ? $this->sectionIdForPamanaUser($pamanaUserId) : '';
        $sectionName = $sectionId !== '' ? $this->sectionName($sectionId) : '';

        if ($sectionId === '') {
            return ['users' => [], 'sectionId' => '', 'sectionName' => ''];
        }

        $rows = $this->activeStaffInSection($sectionId);
        $users = [];
        $seen = [];
        foreach ($rows as $row) {
            $mapped = $this->mapSectionStaffToTicketingUser($row, $sectionName);
            if (! $mapped) {
                continue;
            }
            if (isset($seen[$mapped['_id']])) {
                continue;
            }
            $seen[$mapped['_id']] = true;
            $users[] = $mapped;
        }

        usort($users, fn ($a, $b) => strcasecmp($a['name'], $b['name']));

        return [
            'users' => $users,
            'sectionId' => $sectionId,
            'sectionName' => $sectionName,
        ];
    }

    private function pamanaStaffUserIdForTicketingUser(User $user): ?string
    {
        $email = strtolower(trim((string) $user->email));
        $org = OrgUser::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (! $org && str_contains($email, '@')) {
            $local = strstr($email, '@', true) ?: '';
            if ($local !== '') {
                $org = OrgUser::query()
                    ->whereRaw('LOWER(username) = ?', [strtolower($local)])
                    ->first();
            }
        }

        if ($org) {
            $id = $this->resolvePamanaUserId($org);
            if ($id !== null && $id !== '') {
                return $id;
            }
        }

        try {
            $byEmail = DB::connection('pamana')->selectOne(
                'SELECT id FROM `user` WHERE LOWER(email) = ? LIMIT 1',
                [$email],
            );
            if ($byEmail) {
                return (string) $byEmail->id;
            }
        } catch (Throwable $e) {
            Log::warning('Pamana staff user id lookup failed', ['error' => $e->getMessage()]);
        }

        return null;
    }

    private function sectionIdForPamanaUser(string $pamanaUserId): string
    {
        try {
            $role = DB::connection('pamana')->selectOne(
                "SELECT NULLIF(TRIM(section_id), '') AS section_id
                 FROM staff_role
                 WHERE CAST(user_id AS CHAR) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
                   AND (deleted = 0 OR deleted IS NULL)
                   AND section_id IS NOT NULL
                   AND TRIM(section_id) <> ''
                 ORDER BY updated_at DESC
                 LIMIT 1",
                [$pamanaUserId],
            );
            $fromRole = trim((string) ($role->section_id ?? ''));
            if ($fromRole !== '') {
                return $fromRole;
            }

            $plantilla = DB::connection('pamana')->selectOne(
                "SELECT NULLIF(TRIM(it.sections_id), '') AS section_id
                 FROM staff_appointment sa
                 INNER JOIN item_numbers it
                    ON it.id COLLATE utf8mb4_unicode_ci = sa.item_number_id COLLATE utf8mb4_unicode_ci
                 WHERE CAST(sa.user_id AS CHAR) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
                   AND (sa.deleted = 0 OR sa.deleted IS NULL)
                   AND it.sections_id IS NOT NULL
                   AND TRIM(it.sections_id) <> ''
                 ORDER BY sa.updated_at DESC
                 LIMIT 1",
                [$pamanaUserId],
            );

            return trim((string) ($plantilla->section_id ?? ''));
        } catch (Throwable $e) {
            Log::warning('Pamana section id lookup failed', [
                'pamanaUserId' => $pamanaUserId,
                'error' => $e->getMessage(),
            ]);

            return '';
        }
    }

    private function sectionName(string $sectionId): string
    {
        try {
            $row = DB::connection('pamana')->selectOne(
                'SELECT section_name FROM sections WHERE id = ? LIMIT 1',
                [$sectionId],
            );

            return trim((string) ($row->section_name ?? ''));
        } catch (Throwable) {
            return '';
        }
    }

    /**
     * @return list<object{
     *   user_id: mixed,
     *   first_name: mixed,
     *   middle_name: mixed,
     *   last_name: mixed,
     *   staff_email: mixed,
     *   secondary_email: mixed,
     *   appointment_status: mixed
     * }>
     */
    private function activeStaffInSection(string $sectionId): array
    {
        try {
            return DB::connection('pamana')->select(
                "SELECT
                    st.user_id,
                    TRIM(st.first_name) AS first_name,
                    TRIM(st.middle_name) AS middle_name,
                    TRIM(st.last_name) AS last_name,
                    st.email AS staff_email,
                    st.secondary_email,
                    soa.status_of_name AS appointment_status
                 FROM staffs st
                 INNER JOIN (
                    SELECT CAST(sa.user_id AS CHAR) COLLATE utf8mb4_unicode_ci AS user_id
                    FROM staff_appointment sa
                    INNER JOIN item_numbers it
                        ON it.id COLLATE utf8mb4_unicode_ci = sa.item_number_id COLLATE utf8mb4_unicode_ci
                    WHERE (sa.deleted = 0 OR sa.deleted IS NULL)
                      AND it.sections_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
                    UNION
                    SELECT CAST(sr.user_id AS CHAR) COLLATE utf8mb4_unicode_ci AS user_id
                    FROM staff_role sr
                    WHERE (sr.deleted = 0 OR sr.deleted IS NULL)
                      AND sr.section_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
                 ) members
                    ON members.user_id = st.user_id COLLATE utf8mb4_unicode_ci
                 LEFT JOIN status_of_appointment soa
                    ON soa.id COLLATE utf8mb4_unicode_ci = st.status_of_appointment_id COLLATE utf8mb4_unicode_ci
                 WHERE (st.deleted = 0 OR st.deleted IS NULL)
                   AND (
                        LOWER(TRIM(COALESCE(soa.status_of_name, ''))) = 'active'
                        OR LOWER(TRIM(COALESCE(st.status_of_appointment_id, ''))) = 'unassigned'
                        OR soa.id IS NULL
                   )
                   AND LOWER(TRIM(COALESCE(soa.status_of_name, ''))) NOT IN (
                        'retired', 'resigned', 'end of contract/term', 'transferred', 'terminated', 'deceased'
                   )
                 ORDER BY st.last_name, st.first_name",
                [$sectionId, $sectionId],
            );
        } catch (Throwable $e) {
            Log::warning('Pamana active section staff lookup failed', [
                'sectionId' => $sectionId,
                'error' => $e->getMessage(),
            ]);

            return [];
        }
    }

    /**
     * @param  object{
     *   user_id: mixed,
     *   first_name: mixed,
     *   middle_name: mixed,
     *   last_name: mixed
     * }  $row
     * @return array{_id: string, name: string, email: string, division: string}|null
     */
    private function mapSectionStaffToTicketingUser(object $row, string $sectionName): ?array
    {
        $pamanaUserId = trim((string) ($row->user_id ?? ''));
        $name = trim(implode(' ', array_filter([
            trim((string) ($row->first_name ?? '')),
            trim((string) ($row->middle_name ?? '')),
            trim((string) ($row->last_name ?? '')),
        ], fn ($p) => $p !== '')));

        if ($pamanaUserId === '') {
            return null;
        }

        $org = OrgUser::query()->find((int) $pamanaUserId);
        if (! $org) {
            try {
                $login = DB::connection('pamana')->selectOne(
                    'SELECT username, email FROM `user` WHERE id = ? LIMIT 1',
                    [$pamanaUserId],
                );
            } catch (Throwable) {
                $login = null;
            }
            $username = strtolower(trim((string) ($login->username ?? '')));
            if ($username !== '') {
                $org = OrgUser::query()
                    ->whereRaw('LOWER(username) = ?', [$username])
                    ->first();
            }
        }

        if (! $org || ! $org->is_active) {
            return null;
        }

        $email = strtolower(trim((string) $org->email));
        if ($email === '') {
            return null;
        }

        $user = User::query()->where('email', $email)->first();
        if (! $user) {
            $user = User::create([
                'id' => Id::newId(),
                'email' => $email,
                'password_hash' => (string) $org->password,
                'name' => $name !== '' ? $name : $org->displayName(),
                'role' => $org->ticketingRole(),
                'division' => $sectionName !== '' ? $sectionName : 'ICT',
                'designation' => '',
                'active' => true,
            ]);
        }

        if (! $user->active) {
            return null;
        }

        return [
            '_id' => (string) $user->id,
            'name' => $name !== '' ? $name : $user->name,
            'email' => $user->email,
            'division' => $sectionName !== '' ? $sectionName : (string) ($user->division ?? ''),
        ];
    }
}
