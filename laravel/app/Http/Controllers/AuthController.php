<?php

namespace App\Http\Controllers;

use App\Models\OrgUser;
use App\Models\User;
use App\Services\JwtService;
use App\Services\PamanaEmployeeService;
use App\Support\ApiException;
use App\Support\Id;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function __construct(
        private JwtService $jwt,
        private PamanaEmployeeService $pamana,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|min:1',
            'password' => 'required|string|min:1',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $login = trim((string) $request->input('email'));
        $password = (string) $request->input('password');
        $org = $this->findOrgUser($login);
        if (! $org || ! $org->is_active || ! $org->verifyPassword($password)) {
            throw new ApiException(401, 'Invalid credentials');
        }

        $user = $this->resolveTicketingUser($org);
        $employee = $this->pamana->findForTicketingUser($user);
        $this->pamana->syncTicketingUser($user, $employee);

        return response()->json([
            'token' => $this->jwt->sign($user),
            'user' => $this->pamana->enrichPublicUser($user, $employee),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $auth = $this->authUser($request);
        $user = User::query()->find($auth->id);
        if (! $user || ! $user->active) {
            throw new ApiException(401, 'Invalid session');
        }

        return response()->json([
            'user' => $this->pamana->enrichPublicUser($user),
        ]);
    }

    /**
     * PAMANA-backed requestor fields for TA form auto-fill / preview.
     */
    public function requesterProfile(Request $request): JsonResponse
    {
        $auth = $this->authUser($request);
        $user = User::query()->find($auth->id);
        if (! $user || ! $user->active) {
            throw new ApiException(401, 'Invalid session');
        }

        $employee = $this->pamana->findForTicketingUser($user);

        if ($employee) {
            $profileEmail = $employee['email'] !== '' ? $employee['email'] : (string) $user->email;
            $profile = [
                'name' => $employee['name'],
                'email' => $profileEmail,
                'division' => $employee['division'] !== '' ? $employee['division'] : (string) ($user->division ?? ''),
                'designation' => $employee['designation'] !== '' ? $employee['designation'] : (string) ($user->designation ?? ''),
                'firstName' => $employee['firstName'],
                'middleName' => $employee['middleName'],
                'lastName' => $employee['lastName'],
            ];
        } else {
            $profile = [
                'name' => '',
                'email' => '',
                'division' => '',
                'designation' => '',
                'firstName' => '',
                'middleName' => '',
                'lastName' => '',
            ];
        }

        return response()->json([
            'found' => $employee !== null,
            'source' => $employee !== null ? 'pamana_employees_new' : null,
            'profile' => $profile,
            'values' => \App\Utils\ProfilePlacementFields::buildRequesterProfileAnswerValues($profile),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:1|max:120',
            'division' => 'required|string|min:1|max:255',
            'designation' => 'nullable|string|max:120',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $auth = $this->authUser($request);
        $user = User::query()->find($auth->id);
        if (! $user || ! $user->active) {
            throw new ApiException(404, 'User not found');
        }

        $user->name = trim((string) $request->input('name'));
        $user->division = trim((string) $request->input('division'));
        $user->designation = trim((string) $request->input('designation', ''));
        $user->save();

        return response()->json(['user' => $this->pamana->enrichPublicUser($user)]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'currentPassword' => 'required|string|min:1',
            'newPassword' => 'required|string|min:6|max:128',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $auth = $this->authUser($request);
        $user = User::query()->find($auth->id);
        if (! $user || ! $user->active) {
            throw new ApiException(404, 'User not found');
        }

        $org = OrgUser::query()
            ->whereRaw('LOWER(email) = ?', [strtolower($user->email)])
            ->first();

        $current = (string) $request->input('currentPassword');
        $orgOk = $org && $org->verifyPassword($current);
        $profileOk = Hash::check($current, $user->password_hash);
        if (! $orgOk && ! $profileOk) {
            throw new ApiException(400, 'Current password is incorrect');
        }

        if ($request->input('currentPassword') === $request->input('newPassword')) {
            throw new ApiException(400, 'New password must be different from the current password');
        }

        $newHash = Hash::make((string) $request->input('newPassword'));
        $user->password_hash = $newHash;
        $user->save();

        if ($org) {
            $org->password = $newHash;
            $org->save();
        }

        return response()->json(['ok' => true]);
    }

    private function findOrgUser(string $login): ?OrgUser
    {
        $login = trim($login);
        if ($login === '') {
            return null;
        }

        $lower = strtolower($login);
        $local = str_contains($lower, '@') ? strstr($lower, '@', true) : $lower;
        $local = $local !== false ? $local : $lower;

        return OrgUser::query()
            ->where('is_active', true)
            ->where(function ($q) use ($lower, $local) {
                $q->whereRaw('LOWER(email) = ?', [$lower])
                    ->orWhereRaw('LOWER(username) = ?', [$local])
                    ->orWhereRaw('LOWER(username) = ?', [$lower]);
            })
            ->first();
    }

    /**
     * Ticketing rows live in `users_` (CHAR ids / FKs). Ensure a profile exists for this org login.
     */
    private function resolveTicketingUser(OrgUser $org): User
    {
        $email = strtolower((string) $org->email);
        $user = User::query()->where('email', $email)->first();
        $mappedRole = $org->ticketingRole();

        if ($user) {
            if (! $user->active) {
                throw new ApiException(401, 'Invalid credentials');
            }
            // Keep records role if already set; otherwise refresh from org Spatie roles.
            if ($user->role !== 'record_management' && $mappedRole !== 'user') {
                $user->role = $mappedRole;
            }
            if (trim((string) $user->name) === '') {
                $user->name = $org->displayName();
            }
            $user->password_hash = (string) $org->password;
            $user->save();

            return $user;
        }

        return User::create([
            'id' => Id::newId(),
            'email' => $email,
            'password_hash' => (string) $org->password,
            'name' => $org->displayName(),
            'role' => $mappedRole,
            'division' => 'ICT',
            'designation' => '',
            'active' => true,
        ]);
    }
}
