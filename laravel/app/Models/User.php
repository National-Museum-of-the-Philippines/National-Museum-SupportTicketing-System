<?php

namespace App\Models;

use App\Support\Id;
use App\Traits\ApiSerializable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;

class User extends Model
{
    use ApiSerializable;

    /** Ticketing profile table (CHAR ids). Login credentials live on MySQL `users` via OrgUser. */
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
