<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\FormController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\RbacController;
use App\Http\Controllers\RecordsController;
use App\Http\Controllers\SuperAdminController;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\UploadController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::middleware('jwt.auth')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::get('/requester-profile', [AuthController::class, 'requesterProfile']);
        Route::patch('/profile', [AuthController::class, 'updateProfile']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });
});

Route::middleware('jwt.auth')->prefix('forms')->group(function () {
    Route::get('/published', [FormController::class, 'published']);
    Route::get('/published/{id}', [FormController::class, 'publishedShow']);
    Route::get('/published/{id}/document.pdf', [FormController::class, 'publishedPdf']);

    Route::middleware('role:admin')->group(function () {
        Route::get('/mine/analytics', [FormController::class, 'mineAnalytics']);
        Route::get('/mine', [FormController::class, 'mine']);
        Route::get('/action-officer-staff', [FormController::class, 'actionOfficerStaff']);
        Route::post('/', [FormController::class, 'store']);
        Route::post('/submit-to-records', [FormController::class, 'submitToRecords']);
        Route::patch('/{id}', [FormController::class, 'update']);
        Route::post('/{id}/submit-for-review', [FormController::class, 'submitForReview']);
    });

    Route::get('/{id}', [FormController::class, 'show'])->middleware('role:admin,record_management');
});

Route::middleware(['jwt.auth', 'role:record_management'])->prefix('records')->group(function () {
    Route::get('/dashboard', [RecordsController::class, 'dashboard']);
    Route::get('/forms', [RecordsController::class, 'forms']);
    Route::get('/forms/{id}/document.pdf', [RecordsController::class, 'formPdf']);
    Route::get('/forms/{id}', [RecordsController::class, 'formShow']);
    Route::post('/forms/{id}/review', [RecordsController::class, 'review']);
    Route::get('/activity', [RecordsController::class, 'activity']);
});

Route::middleware('jwt.auth')->prefix('tickets')->group(function () {
    Route::post('/', [TicketController::class, 'store'])->middleware('role:user,admin');
    Route::get('/mine', [TicketController::class, 'mine'])->middleware('role:user,admin');
    Route::get('/for-review', [TicketController::class, 'forReview'])->middleware('role:user,admin');
    Route::get('/assigned/mine', [TicketController::class, 'assignedMine'])->middleware('role:user,admin');
    Route::get('/', [TicketController::class, 'index'])->middleware('role:admin');
    Route::get('/assignees', [TicketController::class, 'assignees'])->middleware('role:admin');
    Route::get('/{id}/document.pdf', [TicketController::class, 'documentPdf']);
    Route::get('/{id}', [TicketController::class, 'show']);
    Route::post('/{id}/approve', [TicketController::class, 'approve'])->middleware('role:user,admin');
    Route::post('/{id}/reject', [TicketController::class, 'reject'])->middleware('role:user,admin');
    Route::post('/{id}/assign', [TicketController::class, 'assign'])->middleware('role:admin');
    Route::post('/{id}/complete', [TicketController::class, 'complete'])->middleware('role:user,admin');
    Route::patch('/{id}/status', [TicketController::class, 'updateStatus'])->middleware('role:admin');
    Route::post('/{id}/confirm', [TicketController::class, 'confirm'])->middleware('role:user,admin');
    Route::post('/{id}/feedback', [TicketController::class, 'feedback'])->middleware('role:user,admin');
});

Route::middleware(['jwt.auth', 'role:admin,user'])->prefix('messages')->group(function () {
    Route::get('/users', [MessageController::class, 'users']);
    Route::get('/conversations', [MessageController::class, 'conversations']);
    Route::post('/conversations/direct', [MessageController::class, 'direct']);
    Route::post('/poke', [MessageController::class, 'poke']);
    Route::get('/pokes/recent', [MessageController::class, 'recentPokes']);
    Route::get('/conversations/ticket/{ticketId}', [MessageController::class, 'ticketConversation']);
    Route::get('/conversations/{id}/mentionable', [MessageController::class, 'mentionable']);
    Route::get('/conversations/{id}/messages', [MessageController::class, 'messages']);
    Route::post('/conversations/{id}/messages', [MessageController::class, 'postMessage']);
});

Route::middleware('jwt.auth')->post('/uploads', [UploadController::class, 'store']);

Route::middleware(['jwt.auth', 'role:admin'])->prefix('rbac')->group(function () {
    Route::get('/summary', [RbacController::class, 'summary']);
    Route::get('/roles', [RbacController::class, 'roles']);
    Route::post('/roles', [RbacController::class, 'storeRole']);
    Route::patch('/roles/{roleId}', [RbacController::class, 'updateRole']);
    Route::delete('/roles/{roleId}', [RbacController::class, 'destroyRole']);
    Route::put('/roles/{roleId}/permissions', [RbacController::class, 'syncRolePermissions']);
    Route::get('/permissions', [RbacController::class, 'permissions']);
    Route::get('/employees', [RbacController::class, 'employees']);
    Route::put('/employees/{userId}/roles', [RbacController::class, 'syncRoles']);
});

Route::middleware(['jwt.auth', 'role:admin'])->prefix('super-admin')->group(function () {
    Route::get('/overview', [SuperAdminController::class, 'overview']);
});
