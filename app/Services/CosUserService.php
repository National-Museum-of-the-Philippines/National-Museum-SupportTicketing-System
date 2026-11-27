<?php

namespace App\Services;

use App\Models\CosStaff;
use App\Models\CosUser;
use App\Models\PamanaAuthUser;
use App\Models\User;
use App\Support\ApiException;
use App\Support\AuthUser;
use App\Support\Id;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * User Management for COS staff. PAMANA is only read (to find the Admin's section and to
 * refuse an email PAMANA already has); nothing is ever written there.
 */
class CosUserService
{
    public function __construct(
        private PamanaEmployeeService $pamana,
        private ActivityService $activity,
    ) {}

    /** @return array{items: list<array<string, mixed>>, section: string} */
    public function list(AuthUser $actor): array
    {
        $section = $this->adminSection($actor);

        $items = CosStaff::query()
            ->with('account')
            ->where('section_id', $section['id'])
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn (CosStaff $s) => $s->account !== null)
            ->map(fn (CosStaff $s) => $this->serialize($s))
            ->values()
            ->all();

        return ['items' => $items, 'section' => $section['name']];
    }

    /**
     * @param  array{email: string, name: string, designation: string, password: string}  $data
     * @return array<string, mixed>
     */
    public function create(AuthUser $actor, array $data): array
    {
        $section = $this->adminSection($actor);
        $email = strtolower(trim($data['email']));

        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            throw new ApiException(422, 'This email is already registered in the system.');
        }
        if (PamanaAuthUser::findByLogin($email)) {
            throw new ApiException(422, 'This email already has a PAMANA account. That person signs in with PAMANA.');
        }

        $staff = DB::transaction(function () use ($actor, $data, $email, $section) {
            // The row tickets, assignments and chats point to. Its password is never used.
            $profile = User::create([
                'id' => Id::newId(),
                'email' => $email,
                'password_hash' => Hash::make(Str::random(48)),
                'name' => trim($data['name']),
                'role' => 'user',
                'division' => $section['name'],
                'designation' => trim($data['designation']),
                'active' => true,
                'profile_customized_at' => now(),
            ]);

            // Registration: the account in cos_users, the details in cos_staffs.
            $account = CosUser::create([
                'username' => CosUser::makeUsername($data['name']),
                'password_hash' => Hash::make($data['password']),
                'profile_id' => (string) $profile->id,
            ]);

            return CosStaff::create([
                'user_id' => $account->id,
                'email' => $email,
                'name' => trim($data['name']),
                'designation' => trim($data['designation']),
                'section_id' => $section['id'],
                'section_name' => $section['name'],
                'active' => true,
                'created_by' => $actor->id,
            ]);
        });

        $this->activity->logActivity($actor, [
            'action' => 'cos_user_created',
            'entityType' => 'user',
            'entityId' => (string) $staff->account->profile_id,
            'summary' => 'Added COS staff '.trim($data['name']).' ('.$section['name'].')',
        ]);

        return $this->serialize($staff);
    }

    /** Deactivating keeps all history; the person just cannot sign in. */
    public function setActive(AuthUser $actor, string $userId, bool $active): array
    {
        $section = $this->adminSection($actor);
        $staff = CosStaff::query()
            ->with('account.profile')
            ->where('section_id', $section['id'])
            ->whereHas('account', fn ($q) => $q->where('profile_id', $userId))
            ->first();
        if (! $staff || ! $staff->account?->profile) {
            throw new ApiException(404, 'COS user not found in your section');
        }

        DB::transaction(function () use ($staff, $active) {
            $staff->active = $active;
            $staff->save();
            // The profile row carries the sign-in session, so it follows.
            $staff->account->profile->active = $active;
            $staff->account->profile->save();
        });

        $this->activity->logActivity($actor, [
            'action' => $active ? 'cos_user_activated' : 'cos_user_deactivated',
            'entityType' => 'user',
            'entityId' => $userId,
            'summary' => ($active ? 'Activated' : 'Deactivated').' COS staff '.$staff->name,
        ]);

        return $this->serialize($staff);
    }

    /** @return array{id: string, name: string} */
    private function adminSection(AuthUser $actor): array
    {
        $admin = User::query()->find($actor->id);
        $section = $admin ? $this->pamana->sectionOf($admin) : null;
        if (! $section) {
            throw new ApiException(422, 'Your section was not found in PAMANA, so COS staff cannot be added.');
        }

        return $section;
    }

    /** @return array<string, mixed> */
    private function serialize(CosStaff $staff): array
    {
        return [
            // The ticketing profile id: what tickets and the activate / deactivate call use.
            'userId' => (string) $staff->account->profile_id,
            'username' => $staff->account->username,
            'email' => $staff->email,
            'name' => $staff->name,
            'designation' => $staff->designation,
            'division' => $staff->section_name,
            'role' => 'Staff',
            'active' => (bool) $staff->active,
            'createdAt' => optional($staff->created_at)?->toISOString(),
        ];
    }
}
