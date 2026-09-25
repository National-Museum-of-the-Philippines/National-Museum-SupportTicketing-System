<?php

namespace App\Http\Controllers;

use App\Support\AuthUser;
use Illuminate\Http\Request;

abstract class Controller
{
    protected function authUser(Request $request): AuthUser
    {
        /** @var AuthUser $user */
        $user = $request->attributes->get('authUser');

        return $user;
    }
}
