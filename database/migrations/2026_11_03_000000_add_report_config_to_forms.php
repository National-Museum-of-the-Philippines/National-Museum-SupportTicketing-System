<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            // How the form's owner chose to show each field in My Forms: {fieldId: donut|bar|table|none}.
            $table->json('report_config')->nullable()->after('print_placement_font_size');
        });
    }

    public function down(): void
    {
        Schema::table('forms', function (Blueprint $table) {
            $table->dropColumn('report_config');
        });
    }
};
