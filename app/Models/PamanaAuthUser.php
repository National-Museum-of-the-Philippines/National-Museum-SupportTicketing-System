<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Login account in pamana_auth.user — the main source of users
 * (username, email, password_hash, status). The schema is never migrated.
 *
 * Other auth methods (2FA, remember token) live on nmp_ticketing.users
 * under the same id; see OrgUser.
 */
class PamanaAuthUser extends Model
{
    public const STATUS_ACTIVE = 10;

    /** pamana_auth.auth_assignment item held by security guards. */
    public const GUARD_ROLE = 'guard';

    protected $connection = 'pamana_auth';

    protected $table = 'user';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'int';

    /** created_at / updated_at are unix integers maintained by PAMANA. */
    public $timestamps = false;

    protected $guarded = ['*'];

    protected $hidden = [
        'password',
        'password_hash',
        'auth_key',
        'password_reset_token',
        'verification_token',
    ];

    /** Match a sign-in identifier: full email, username, or the email local-part as username. */
    public static function findByLogin(string $login): ?self
    {
        $lower = strtolower(trim($login));
        if ($lower === '') {
            return null;
        }

        $local = str_contains($lower, '@') ? (string) strstr($lower, '@', true) : $lower;

        return self::lookup(fn () => self::query()
            ->where(function ($q) use ($lower, $local) {
                $q->whereRaw('LOWER(email) = ?', [$lower])
                    ->orWhereRaw('LOWER(username) = ?', [$local])
                    ->orWhereRaw('LOWER(username) = ?', [$lower]);
            })
            ->orderByRaw('LOWER(email) = ? DESC', [$lower])
            ->first());
    }

    public static function findByAuthId(int|string $id): ?self
    {
        $id = trim((string) $id);
        if ($id === '' || ! ctype_digit($id)) {
            return null;
        }

        return self::lookup(fn () => self::query()->find((int) $id));
    }

    public static function findByUsername(string $username): ?self
    {
        $username = strtolower(trim($username));
        if ($username === '') {
            return null;
        }

        return self::lookup(fn () => self::query()->whereRaw('LOWER(username) = ?', [$username])->first());
    }

    /** Active account matching the login whose password_hash accepts the password. */
    public static function attempt(string $login, string $password): ?self
    {
        $account = self::findByLogin($login);

        return $account && $account->isActive() && $account->passwordMatches($password) ? $account : null;
    }

    public function isActive(): bool
    {
        return (int) $this->status === self::STATUS_ACTIVE;
    }

    public function passwordMatches(string $plain): bool
    {
        $hash = (string) $this->password_hash;
        if ($plain === '' || ! str_starts_with($hash, '$2')) {
            return false;
        }

        try {
            return Hash::check($plain, $hash);
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * Security personnel (agency guards) are not allowed to sign in: accounts holding
     * the PAMANA `guard` role, or listed in pamana_employees_new.security.
     * Lookup failures are not swallowed, so a failed check never lets a guard in.
     */
    public function isSecurityPersonnel(): bool
    {
        $hasGuardRole = DB::connection('pamana_auth')->table('auth_assignment')
            ->where('user_id', (string) $this->id)
            ->where('item_name', self::GUARD_ROLE)
            ->exists();
        if ($hasGuardRole) {
            return true;
        }

        return DB::connection('pamana')->table('security')
            ->where('user_id', $this->id)
            ->where(fn ($q) => $q->where('deleted', 0)->orWhereNull('deleted'))
            ->exists();
    }

    /** Auth-method columns for this account on nmp_ticketing.users (unsaved when none exist yet). */
    public function authMethods(): OrgUser
    {
        return OrgUser::forAuthId($this->id);
    }

    /**
     * Map Spatie role names on this account to Support Ticketing System portal roles.
     *
     * @return 'super_admin'|'admin'|'record_management'|'user'
     */
    public function ticketingRole(): string
    {
        $names = DB::table('model_has_roles as mhr')
            ->join('roles as r', 'r.id', '=', 'mhr.role_id')
            ->where('mhr.model_id', $this->id)
            ->where(function ($q) {
                $q->where('mhr.model_type', 'App\\Models\\User')
                    ->orWhere('mhr.model_type', 'App\\Models\\Yii2User')
                    ->orWhere('mhr.model_type', 'like', '%User');
            })
            ->pluck('r.name')
            ->map(fn ($n) => strtolower((string) $n));

        if ($names->contains('super_admin')) {
            return 'super_admin';
        }
        if ($names->contains('admin')) {
            return 'admin';
        }
        if ($names->contains('record_management') || $names->contains('records')) {
            return 'record_management';
        }

        return 'user';
    }

    public function displayName(): string
    {
        $username = trim((string) ($this->username ?? ''));
        if ($username !== '') {
            return $username;
        }

        $email = (string) $this->email;
        $local = strstr($email, '@', true);

        return $local !== false && $local !== '' ? $local : $email;
    }

    /**
     * @param  callable(): ?self  $query
     */
    private static function lookup(callable $query): ?self
    {
        try {
            return $query();
        } catch (Throwable $e) {
            Log::warning('pamana_auth user lookup failed', ['error' => $e->getMessage()]);

            return null;
        }
    }
}
