<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Organizational login account in MySQL `users`
 * (password, is_active, username — Spatie roles via model_has_roles).
 */
class OrgUser extends Model
{
    protected $table = 'users';

    protected $primaryKey = 'id';

    public $incrementing = true;

    protected $keyType = 'int';

    protected $fillable = [
        'username',
        'email',
        'password',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'google2fa_secret',
        'remember_token',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function verifyPassword(string $plain): bool
    {
        $hash = (string) $this->password;
        if ($hash === '') {
            return false;
        }

        if (Hash::check($plain, $hash)) {
            return true;
        }

        // Legacy hashes (e.g. plain bcrypt variants already covered by Hash::check)
        return false;
    }

    public function setPlainPassword(string $plain): void
    {
        $this->password = Hash::make($plain);
    }

    /**
     * Map Spatie role names on this org user to Support Ticketing System portal roles.
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
        if ($names->contains('user') || $names->contains('staff')) {
            return 'user';
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
}
