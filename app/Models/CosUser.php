<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/** The sign-in account of a COS staff member added by an Admin. Not part of PAMANA. */
class CosUser extends Model
{
    protected $table = 'cos_users';

    protected $fillable = ['username', 'password_hash', 'profile_id'];

    protected $hidden = ['password_hash'];

    /** The details (cos_staffs.user_id -> cos_users.id). */
    public function staff(): HasOne
    {
        return $this->hasOne(CosStaff::class, 'user_id');
    }

    /** The users_ row that tickets, assignments and chats point to. */
    public function profile(): BelongsTo
    {
        return $this->belongsTo(User::class, 'profile_id');
    }

    /** The COS account behind a ticketing profile, or null for PAMANA people. */
    public static function forUser(User|string|null $user): ?self
    {
        $id = $user instanceof User ? (string) $user->id : (string) $user;

        return $id === '' ? null : self::query()->with('staff')->where('profile_id', $id)->first();
    }

    /**
     * "Ysa Marie Victorio" -> "ysa.victorio" (first and last word of the display name). A number
     * is added when PAMANA or another COS account already uses it.
     */
    public static function makeUsername(string $displayName): string
    {
        $words = array_values(array_filter(array_map(
            fn (string $w) => preg_replace('/[^a-z0-9-]/', '', strtolower(Str::ascii($w))),
            preg_split('/\s+/', trim($displayName)) ?: [],
        )));
        $base = match (count($words)) {
            0 => 'cos.user',
            1 => $words[0],
            default => $words[0].'.'.$words[count($words) - 1],
        };

        $username = $base;
        for ($n = 2; self::query()->where('username', $username)->exists() || PamanaAuthUser::findByUsername($username); $n++) {
            $username = $base.$n;
        }

        return $username;
    }

    /** The profile of an active COS account whose username (or email) and password match. */
    public static function attempt(string $login, string $password): ?User
    {
        $login = strtolower(trim($login));
        $cos = self::query()->whereRaw('LOWER(username) = ?', [$login])->first()
            ?? CosStaff::query()->whereRaw('LOWER(email) = ?', [$login])->first()?->account;
        if (! $cos || ! Hash::check($password, $cos->password_hash)) {
            return null;
        }

        $profile = $cos->profile;

        return $profile && $profile->active && $cos->staff?->active ? $profile : null;
    }
}
