<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('error_logs', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('source', 16)->index();       // server | client | console
            $table->string('level', 16)->index();        // error | warning
            $table->unsignedSmallInteger('status')->nullable();
            $table->text('message');
            $table->string('exception')->nullable();
            $table->string('file')->nullable();
            $table->unsignedInteger('line')->nullable();
            $table->text('trace')->nullable();
            $table->string('method', 10)->nullable();
            $table->text('url')->nullable();
            $table->string('user_id')->nullable();
            $table->string('user_name')->nullable();
            $table->string('user_role', 32)->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('fingerprint', 40)->index();
            $table->unsignedInteger('occurrences')->default(1);
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamp('resolved_at')->nullable()->index();
            $table->string('resolved_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('error_logs');
    }
};
