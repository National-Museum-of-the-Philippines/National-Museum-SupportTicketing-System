<?php

use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\JwtAuthenticate;
use App\Services\ErrorMonitorService;
use App\Support\ApiException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withBroadcasting(
        channels: __DIR__.'/../routes/channels.php',
        attributes: ['middleware' => ['api', 'jwt.auth']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'jwt.auth' => JwtAuthenticate::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Error Monitoring (Super Admin): persist failures before they are logged.
        $exceptions->report(function (Throwable $e): void {
            app(ErrorMonitorService::class)->recordThrowable(
                $e,
                app()->bound('request') ? app('request') : null,
            );
        });

        $exceptions->render(function (ApiException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['error' => $e->getMessage()], $e->status);
            }
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $status = method_exists($e, 'getStatusCode') ? (int) $e->getStatusCode() : 500;
                if ($status < 400) {
                    $status = 500;
                }

                return response()->json([
                    'error' => config('app.debug') ? $e->getMessage() : 'Server error',
                ], $status >= 400 ? $status : 500);
            }
        });
    })->create();
