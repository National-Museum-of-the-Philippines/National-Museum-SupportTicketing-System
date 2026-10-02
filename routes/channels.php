<?php

use App\Support\AuthUser;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('user.{id}', function (AuthUser $user, string $id) {
    return $user->id === $id;
});

Broadcast::channel('role.{role}', function (AuthUser $user, string $role) {
    if ($user->role === $role) {
        return true;
    }

    return $user->role === 'super_admin' && in_array($role, ['admin', 'record_management'], true);
});

Broadcast::channel('inbox', function (AuthUser $user) {
    return $user->id !== '';
});
