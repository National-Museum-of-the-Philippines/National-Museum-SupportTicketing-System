<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->boolean('require_recommending_officer')->default(false)->after('department');
            $table->boolean('require_immediate_supervisor')->default(false)->after('require_recommending_officer');
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->string('client_approval_stage', 32)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn(['require_recommending_officer', 'require_immediate_supervisor']);
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn('client_approval_stage');
        });
    }
};
