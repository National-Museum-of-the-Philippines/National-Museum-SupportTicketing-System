<?php

namespace App\Services;

use App\Models\OrgUser;
use App\Models\PamanaAuthUser;
use App\Support\ApiException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Throwable;

/**
 * Other auth methods for a pamana_auth.user account. Everything a user requests
 * here is stored on nmp_ticketing `users` (OrgUser) under the account id;
 * pamana_auth itself is never written.
 */
class AuthMethodService
{
    private const ISSUER = 'NMP Support Ticketing';

    private const MAX_CODE_ATTEMPTS = 5;

    private const CODE_LOCKOUT_SECONDS = 300;

    public function __construct(private TotpService $totp) {}

    /**
     * @return array{twoFactor: array{enabled: bool, pending: bool, confirmedAt: string|null, recoveryCodesLeft: int}}
     */
    public function status(PamanaAuthUser $account): array
    {
        $methods = $account->authMethods();

        return [
            'twoFactor' => [
                'enabled' => $methods->hasTwoFactor(),
                'pending' => ! $methods->hasTwoFactor() && trim((string) $methods->two_factor_secret) !== '',
                'confirmedAt' => $methods->two_factor_confirmed_at?->toIso8601String(),
                'recoveryCodesLeft' => count($this->recoveryCodes($methods)),
            ],
        ];
    }

    /**
     * User requested an authenticator app: store a fresh secret and recovery codes.
     * The method only takes effect at login once confirmTwoFactor() succeeds.
     *
     * @return array{secret: string, otpauthUri: string, recoveryCodes: list<string>}
     */
    public function requestTwoFactor(PamanaAuthUser $account): array
    {
        $methods = $account->authMethods();
        if ($methods->hasTwoFactor()) {
            throw new ApiException(400, 'Two-factor authentication is already enabled');
        }

        $secret = $this->totp->generateSecret();
        $codes = $this->newRecoveryCodes();

        $methods->two_factor_secret = Crypt::encryptString($secret);
        $methods->two_factor_recovery_codes = Crypt::encryptString(json_encode($codes));
        $methods->two_factor_confirmed_at = null;
        $methods->save();

        return [
            'secret' => $secret,
            'otpauthUri' => $this->totp->provisioningUri($secret, (string) $account->username, self::ISSUER),
            'recoveryCodes' => $codes,
        ];
    }

    public function confirmTwoFactor(PamanaAuthUser $account, string $code): void
    {
        $methods = $account->authMethods();
        if ($methods->hasTwoFactor()) {
            throw new ApiException(400, 'Two-factor authentication is already enabled');
        }
        if ($this->secret($methods) === null) {
            throw new ApiException(400, 'Request two-factor authentication first');
        }
        if (! $this->verifyTotp($methods, $code)) {
            throw new ApiException(422, 'The authentication code is incorrect');
        }

        $methods->two_factor_confirmed_at = now();
        $methods->save();
    }

    /**
     * Replace the recovery codes; the old ones stop working.
     *
     * @return list<string>
     */
    public function regenerateRecoveryCodes(PamanaAuthUser $account): array
    {
        $methods = $account->authMethods();
        if (! $methods->hasTwoFactor()) {
            throw new ApiException(400, 'Multi-factor authentication is not enabled');
        }

        $codes = $this->newRecoveryCodes();
        $methods->two_factor_recovery_codes = Crypt::encryptString(json_encode($codes));
        $methods->save();

        return $codes;
    }

    /**
     * Account ids (of those given) with a confirmed second factor.
     *
     * @param  list<int>  $accountIds
     * @return list<int>
     */
    public function enabledAccountIds(array $accountIds): array
    {
        if ($accountIds === []) {
            return [];
        }

        return OrgUser::query()
            ->whereIn('id', $accountIds)
            ->whereNotNull('two_factor_secret')
            ->whereNotNull('two_factor_confirmed_at')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /** Also the admin reset: the user signs in with the password alone and can enroll again. */
    public function disableTwoFactor(PamanaAuthUser $account): void
    {
        $methods = $account->authMethods();
        if (! $methods->exists) {
            return;
        }

        $methods->two_factor_secret = null;
        $methods->two_factor_recovery_codes = null;
        $methods->two_factor_confirmed_at = null;
        $methods->save();

        RateLimiter::clear('two-factor:'.$account->id);
    }

    public function requiresTwoFactor(PamanaAuthUser $account): bool
    {
        return $account->authMethods()->hasTwoFactor();
    }

    /**
     * Second sign-in step: an authenticator code, or a single-use recovery code.
     */
    public function verifyLoginCode(PamanaAuthUser $account, string $code): bool
    {
        $key = 'two-factor:'.$account->id;
        if (RateLimiter::tooManyAttempts($key, self::MAX_CODE_ATTEMPTS)) {
            throw new ApiException(429, 'Too many incorrect codes. Try again in a few minutes.');
        }

        $methods = $account->authMethods();
        if ($this->verifyTotp($methods, $code) || $this->consumeRecoveryCode($methods, $code)) {
            RateLimiter::clear($key);

            return true;
        }

        RateLimiter::hit($key, self::CODE_LOCKOUT_SECONDS);

        return false;
    }

    /**
     * @return list<string>
     */
    private function newRecoveryCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < 8; $i++) {
            $codes[] = Str::lower(Str::random(5).'-'.Str::random(5));
        }

        return $codes;
    }

    private function verifyTotp(OrgUser $methods, string $code): bool
    {
        $secret = $this->secret($methods);
        if ($secret === null) {
            return false;
        }

        $step = $this->totp->matchingStep($secret, $code);
        if ($step === null) {
            return false;
        }

        // Each code is accepted once.
        return Cache::add('two-factor-used:'.$methods->id.':'.$step, true, 120);
    }

    private function consumeRecoveryCode(OrgUser $methods, string $code): bool
    {
        $code = strtolower(trim($code));
        $codes = $this->recoveryCodes($methods);
        foreach ($codes as $i => $known) {
            if (hash_equals($known, $code)) {
                unset($codes[$i]);
                $methods->two_factor_recovery_codes = Crypt::encryptString(json_encode(array_values($codes)));
                $methods->save();

                return true;
            }
        }

        return false;
    }

    private function secret(OrgUser $methods): ?string
    {
        $stored = trim((string) $methods->two_factor_secret);
        if ($stored === '') {
            return null;
        }

        try {
            return Crypt::decryptString($stored);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @return list<string>
     */
    private function recoveryCodes(OrgUser $methods): array
    {
        $stored = trim((string) $methods->two_factor_recovery_codes);
        if ($stored === '') {
            return [];
        }

        try {
            $codes = json_decode(Crypt::decryptString($stored), true);
        } catch (Throwable) {
            return [];
        }

        return is_array($codes) ? array_values(array_map('strval', $codes)) : [];
    }
}
