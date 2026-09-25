<?php

namespace App\Http\Controllers;

use App\Models\Form;
use App\Models\Ticket;
use App\Models\User;
use App\Services\ActivityService;
use App\Support\ApiException;
use App\Support\AuthUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SuperAdminController extends Controller
{
    public function __construct(private ActivityService $activity) {}

    public function overview(Request $request): JsonResponse
    {
        /** @var AuthUser $user */
        $user = $request->attributes->get('authUser');
        if ($user->role !== 'super_admin') {
            throw new ApiException(403, 'Super Admin access required');
        }

        $ticketCounts = Ticket::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $formCounts = Form::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'users' => [
                'total' => User::query()->where('active', true)->count(),
                'superAdmins' => User::query()->where('role', 'super_admin')->where('active', true)->count(),
                'admins' => User::query()->where('role', 'admin')->where('active', true)->count(),
                'records' => User::query()->where('role', 'record_management')->where('active', true)->count(),
                'staff' => User::query()->where('role', 'user')->where('active', true)->count(),
            ],
            'forms' => [
                'draft' => (int) ($formCounts['draft'] ?? 0),
                'pendingReview' => (int) ($formCounts['pending_review'] ?? 0),
                'published' => (int) ($formCounts['published'] ?? 0),
                'disapproved' => (int) ($formCounts['disapproved'] ?? 0),
            ],
            'tickets' => [
                'pendingApproval' => (int) ($ticketCounts['pending_approval'] ?? 0),
                'open' => (int) ($ticketCounts['open'] ?? 0),
                'inProgress' => (int) ($ticketCounts['in_progress'] ?? 0),
                'pending' => (int) ($ticketCounts['pending'] ?? 0),
                'resolved' => (int) ($ticketCounts['resolved'] ?? 0),
                'closed' => (int) ($ticketCounts['closed'] ?? 0),
                'reopened' => (int) ($ticketCounts['reopened'] ?? 0),
                'rejected' => (int) ($ticketCounts['rejected'] ?? 0),
            ],
            'recentActivities' => $this->activity->listRecentActivities(12),
        ]);
    }
}
