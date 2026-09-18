<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Superseded: the Recommending Officer / Immediate Supervisor for a client request
 * are resolved directly from PAMANA (staff_role.user_id / supervisor_id for the
 * submitter's section), not from an admin-configured mapping.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('recommending_officers');
    }

    public function down(): void
    {
        Schema::create('recommending_officers', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('section_id')->unique();
            $table->string('section_name')->nullable();
            $table->string('user_id');
            $table->string('assigned_by')->nullable();
            $table->timestamps();
        });
    }
};
