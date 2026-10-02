<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Other auth methods for a login account, in nmp_ticketing `users`
 * (two-factor secrets, Google Authenticator secret, remember token).
 *
 * `id` is pamana_auth.user.id. Identity, password, and active status are
 * read from pamana_auth.user (PamanaAuthUser), never from this table.
 */
class OrgUser extends Model
{
    protected $table = 'users';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'int';

    protected $fillable = [
        'id',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_confirmed_at',
        'google2fa_secret',
        'remember_token',
    ];

    protected $hidden = [
        'two_factor_secret',
        'two_factor_recovery_codes',
        'google2fa_secret',
        'remember_token',
    ];

    protected $casts = [
        'two_factor_confirmed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** Row for a pamana_auth.user id; a new unsaved instance when none exists yet. */
    public static function forAuthId(int|string $authId): self
    {
        return self::query()->firstOrNew(['id' => (int) $authId]);
    }

    /** The login account these auth methods belong to. */
    public function account(): ?PamanaAuthUser
    {
        return PamanaAuthUser::findByAuthId($this->id);
    }

    public function hasTwoFactor(): bool
    {
        return trim((string) $this->two_factor_secret) !== '' && $this->two_factor_confirmed_at !== null;
    }

    public function hasGoogle2fa(): bool
    {
        return trim((string) $this->google2fa_secret) !== '';
    }
}
