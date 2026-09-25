<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\JwtService;
use App\Support\ApiException;
use App\Support\AuthUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class JwtAuthenticate
{
    public function __construct(private JwtService $jwt) {}

    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization');
        if (! is_string($header) || ! str_starts_with($header, 'Bearer ')) {
            throw new ApiException(401, 'Authentication required');
        }

        $token = substr($header, 7);

        try {
            $payload = $this->jwt->verify($token);
            $sub = (string) ($payload['sub'] ?? '');
            $user = User::query()->find($sub);
            if (! $user || ! $user->active) {
                throw new ApiException(401, 'Invalid session');
            }

            $authUser = new AuthUser(
                id: (string) $user->id,
                email: $user->email,
                name: $user->name,
                role: $user->role,
                division: $user->division ?? '',
                designation: $user->designation ?? '',
            );

            $request->attributes->set('authUser', $authUser);
            $request->setUserResolver(fn () => $authUser);
        } catch (ApiException $e) {
            throw $e;
        } catch (\Throwable) {
            throw new ApiException(401, 'Invalid or expired token');
        }

        return $next($request);
    }
}
