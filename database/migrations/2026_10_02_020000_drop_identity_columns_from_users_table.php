<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Login identity (username, email, password, active status) is read from
 * pamana_auth.user, so the copies on nmp_ticketing `users` are removed.
 * Only the default (ticketing) connection is touched.
 */
return new class extends Migration
{
    private const IDENTITY_COLUMNS = [
        'name',
        'username',
        'email',
        'email_verified_at',
        'password',
        'is_active',
    ];

    public function up(): void
    {
        foreach (self::IDENTITY_COLUMNS as $column) {
            if (Schema::hasColumn('users', $column)) {
                // One statement per column: MySQL drops the column's own indexes with it.
                Schema::table('users', fn (Blueprint $table) => $table->dropColumn($column));
            }
        }
    }

    public function down(): void
    {
        // Restores the columns only; their data lives in pamana_auth.user.
        Schema::table('users', function (Blueprint $table) {
            foreach (['name', 'username', 'email', 'password'] as $column) {
                if (! Schema::hasColumn('users', $column)) {
                    $table->string($column)->nullable();
                }
            }
            if (! Schema::hasColumn('users', 'email_verified_at')) {
                $table->timestamp('email_verified_at')->nullable();
            }
            if (! Schema::hasColumn('users', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
        });
    }
};
