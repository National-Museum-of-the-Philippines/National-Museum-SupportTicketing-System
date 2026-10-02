<?php

namespace App\Models;

use App\Support\Id;
use App\Traits\ApiSerializable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Throwable;

class User extends Model
{
    use ApiSerializable;

    /** Ticketing profile (`users_`). Login accounts are read from pamana_auth.user. */
    protected $table = 'users_';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'email',
        'password_hash',
        'name',
        'division',
        'designation',
        'role',
        'active',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $casts = [
        'active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if (! $user->id) {
                $user->id = Id::newId();
            }
            if ($user->email) {
                $user->email = strtolower($user->email);
            }
        });
    }

    public function verifyPassword(string $password): bool
    {
        return Hash::check($password, $this->password_hash);
    }

    public function setPassword(string $password): void
    {
        $this->password_hash = Hash::make($password);
    }

    /** Current password check: the ticketing hash, then the pamana_auth login hash. */
    public function passwordMatches(string $plain): bool
    {
        try {
            if ($this->verifyPassword($plain)) {
                return true;
            }
        } catch (Throwable) {
            // users_.password_hash may not be bcrypt yet; pamana_auth holds the login hash.
        }

        return (bool) PamanaAuthUser::findByLogin((string) $this->email)?->passwordMatches($plain);
    }

    public function syncPamanaPasswordHash(): void
    {
        $account = PamanaAuthUser::findByLogin((string) $this->email);
        if (! $account || $this->password_hash === '') {
            return;
        }

        DB::connection('pamana_auth')->table('user')->where('id', $account->id)->update([
            'password_hash' => $this->password_hash,
            'updated_at' => time(),
        ]);
    }

    /**
     * Ticketing profile (`users_`) for a pamana_auth.user account, created on first use.
     * Returns null when the account has no email or the profile is deactivated.
     *
     * @param  array{name?: string, division?: string, designation?: string}  $defaults  used only when creating
     */
    public static function profileForAuthAccount(PamanaAuthUser $account, array $defaults = [], bool $refresh = true): ?self
    {
        $email = strtolower(trim((string) $account->email));
        if ($email === '') {
            return null;
        }

        $user = self::query()->where('email', $email)->first();

        if (! $user) {
            $name = trim((string) ($defaults['name'] ?? ''));

            return self::create([
                'id' => Id::newId(),
                'email' => $email,
                'password_hash' => (string) $account->password_hash,
                'name' => $name !== '' ? $name : $account->displayName(),
                'role' => $account->ticketingRole(),
                'division' => (string) ($defaults['division'] ?? 'ICT'),
                'designation' => (string) ($defaults['designation'] ?? ''),
                'active' => true,
            ]);
        }

        if (! $user->active) {
            return null;
        }

        if ($refresh) {
            $role = $account->ticketingRole();
            if ($user->role !== 'record_management' && $role !== 'user') {
                $user->role = $role;
            }
            if (trim((string) $user->name) === '') {
                $user->name = $account->displayName();
            }
            $user->password_hash = (string) $account->password_hash;
            $user->save();
        }

        return $user;
    }

    /**
     * @return array{id: string, email: string, name: string, role: string, division: string, designation: string}
     */
    public function toPublicUser(): array
    {
        return [
            'id' => (string) $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'role' => $this->role,
            'division' => $this->division ?? '',
            'designation' => $this->designation ?? '',
        ];
    }
}
