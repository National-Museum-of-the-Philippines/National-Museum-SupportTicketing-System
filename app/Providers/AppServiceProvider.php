<?php

namespace App\Providers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // pamana_employees_new and pamana_auth belong to PAMANA: this app only reads them.
        foreach (['pamana', 'pamana_auth'] as $name) {
            DB::connection($name)->beforeExecuting(function (string $query) use ($name) {
                if (! preg_match('/^\s*\(?\s*(select|show|describe|explain)\b/i', $query)) {
                    throw new RuntimeException("The {$name} connection is read-only.");
                }
            });
        }
    }
}
