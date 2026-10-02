<?php

namespace App\Http\Controllers;

use App\Models\PamanaAuthUser;
use App\Models\User;
use App\Services\AuthMethodService;
use App\Services\JwtService;
use App\Services\PamanaEmployeeService;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function __construct(
        private JwtService $jwt,
        private PamanaEmployeeService $pamana,
        private AuthMethodService $authMethods,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|min:1',
            'password' => 'required|string|min:1',
            'code' => 'nullable|string|max:32',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        // Accounts come from pamana_auth.user; other auth methods from nmp_ticketing.users.
        $login = trim((string) $request->input('email'));
        $password = (string) $request->input('password');
        $account = PamanaAuthUser::attempt($login, $password);
        if (! $account) {
            throw new ApiException(401, 'Invalid credentials');
        }
        if ($account->isSecurityPersonnel()) {
            throw new ApiException(403, 'Security personnel accounts are not allowed to sign in to this system.');
        }

        if ($this->authMethods->requiresTwoFactor($account)) {
            $code = trim((string) $request->input('code', ''));
            if ($code === '') {
                return response()->json(['twoFactorRequired' => true]);
            }
            if (! $this->authMethods->verifyLoginCode($account, $code)) {
                throw new ApiException(401, 'The authentication code is incorrect');
            }
        }

        $user = User::profileForAuthAccount($account);
        if (! $user) {
            throw new ApiException(401, 'Invalid credentials');
        }

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
     * Requestor fields for TA form auto-fill. Identity is pamana_auth.user;
     * name, division, and designation are read from pamana_employees_new.
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

    /**
     * Passwords live in pamana_auth.user, which this app never modifies.
     */
    public function changePassword(Request $request): JsonResponse
    {
        throw new ApiException(403, 'Passwords are managed in PAMANA. Change your password there.');
    }

    public function authMethods(Request $request): JsonResponse
    {
        return response()->json($this->authMethods->status($this->authAccount($request)));
    }

    /**
     * User requests an authenticator app. The secret and recovery codes are stored on
     * nmp_ticketing.users and shown once; sign-in asks for a code after confirmation.
     */
    public function requestTwoFactor(Request $request): JsonResponse
    {
        $account = $this->authAccount($request);
        $this->requireCurrentPassword($request, $account);

        return response()->json($this->authMethods->requestTwoFactor($account));
    }

    public function confirmTwoFactor(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:32',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $account = $this->authAccount($request);
        $this->authMethods->confirmTwoFactor($account, (string) $request->input('code'));

        return response()->json($this->authMethods->status($account));
    }

    public function disableTwoFactor(Request $request): JsonResponse
    {
        $account = $this->authAccount($request);
        $this->requireCurrentPassword($request, $account);
        $this->authMethods->disableTwoFactor($account);

        return response()->json($this->authMethods->status($account));
    }

    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        $account = $this->authAccount($request);
        $this->requireCurrentPassword($request, $account);

        return response()->json([
            'recoveryCodes' => $this->authMethods->regenerateRecoveryCodes($account),
        ]);
    }

    private function authAccount(Request $request): PamanaAuthUser
    {
        $account = PamanaAuthUser::findByLogin($this->authUser($request)->email);
        if (! $account || ! $account->isActive()) {
            throw new ApiException(404, 'Login account not found');
        }

        return $account;
    }

    private function requireCurrentPassword(Request $request, PamanaAuthUser $account): void
    {
        if (! $account->passwordMatches((string) $request->input('password', ''))) {
            throw new ApiException(400, 'Password is incorrect');
        }
    }
}
