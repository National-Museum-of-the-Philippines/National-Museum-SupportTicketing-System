<?php

namespace App\Http\Middleware;

use App\Support\ApiException;
use App\Support\AuthUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        /** @var AuthUser|null $user */
        $user = $request->attributes->get('authUser');
        if (! $user instanceof AuthUser) {
            throw new ApiException(401, 'Authentication required');
        }

        // Super Admin may use Admin, Records, and Staff (client) APIs.
        if ($user->role === 'super_admin') {
            return $next($request);
        }

        if ($roles !== [] && ! in_array($user->role, $roles, true)) {
            throw new ApiException(403, 'Insufficient permissions');
        }

        return $next($request);
    }
}
