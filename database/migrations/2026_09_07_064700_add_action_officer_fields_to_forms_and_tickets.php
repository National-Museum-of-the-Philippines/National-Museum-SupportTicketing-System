<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->unsignedInteger('action_officer_count')->default(1)->after('require_immediate_supervisor');
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->unsignedInteger('process_owner_approvals_done')->default(0)->after('client_approval_stage');
            $table->string('process_owner_phase', 32)->nullable()->after('process_owner_approvals_done');
        });
    }

    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn('action_officer_count');
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn(['process_owner_approvals_done', 'process_owner_phase']);
        });
    }
};
