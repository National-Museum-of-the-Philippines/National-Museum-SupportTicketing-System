<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Set when the person saves their own display name / division / designation in Settings. */
    public function up(): void
    {
        Schema::table('users_', function (Blueprint $table) {
            $table->timestamp('profile_customized_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users_', function (Blueprint $table) {
            $table->dropColumn('profile_customized_at');
        });
    }
};
