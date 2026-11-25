<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per person: archived_at hides a private chat until a newer message arrives;
     * cleared_at hides the history up to that moment (delete for me only).
     */
    public function up(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable();
            $table->timestamp('cleared_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('conversation_participants', function (Blueprint $table) {
            $table->dropColumn(['archived_at', 'cleared_at']);
        });
    }
};
