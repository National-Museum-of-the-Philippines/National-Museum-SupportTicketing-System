<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recommending_officers', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('section_id')->unique();
            $table->string('section_name')->nullable();
            $table->string('user_id');
            $table->string('assigned_by')->nullable();
            $table->timestamps();
        });

        Schema::table('tickets', function (Blueprint $table) {
            $table->string('recommending_officer_id')->nullable()->after('client_approval_stage');
            $table->string('recommending_officer_section_id')->nullable()->after('recommending_officer_id');
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropColumn(['recommending_officer_id', 'recommending_officer_section_id']);
        });

        Schema::dropIfExists('recommending_officers');
    }
};
