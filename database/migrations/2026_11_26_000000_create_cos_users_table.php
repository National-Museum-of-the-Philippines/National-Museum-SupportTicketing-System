<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * COS staff are not registered in PAMANA. They live here, in the ticketing database only.
     *
     * cos_users  = the account written at registration (sign-in).
     * cos_staffs = the person's details, which later updates change (user_id -> cos_users.id).
     * profile_id = their row in users_, which tickets, assignments and chats point to.
     */
    public function up(): void
    {
        Schema::create('cos_users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('username', 150)->unique();
            $table->string('password_hash');
            $table->char('profile_id', 24)->unique();
            $table->timestamps();
        });

        Schema::create('cos_staffs', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->unique();
            $table->string('email', 190)->unique();
            $table->string('name', 120);
            $table->string('designation', 120)->default('');
            $table->string('section_id', 64)->index();
            $table->string('section_name');
            $table->boolean('active')->default(true);
            $table->char('created_by', 24);
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('cos_users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cos_staffs');
        Schema::dropIfExists('cos_users');
    }
};
