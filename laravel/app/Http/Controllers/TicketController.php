<?php

namespace App\Http\Controllers;

use App\Services\TicketService;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TicketController extends Controller
{
    private const TICKET_STATUSES = [
        'pending_approval', 'for_client_approval', 'for_process_owner',
        'approved', 'rejected', 'open', 'in_progress',
        'pending', 'resolved', 'closed', 'reopened',
    ];

    public function __construct(private TicketService $tickets) {}

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'formId' => 'required|string',
            'answers' => 'nullable|array',
            'attachmentUrl' => 'nullable|string',
            'attachmentName' => 'nullable|string',
            'attachmentMimeType' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $ticket = $this->tickets->createTicketFromClient($this->authUser($request), (string) $request->input('formId'), [
            'answers' => $request->input('answers', []),
            'attachmentUrl' => $request->input('attachmentUrl'),
            'attachmentName' => $request->input('attachmentName'),
            'attachmentMimeType' => $request->input('attachmentMimeType'),
        ]);

        return response()->json(['ticket' => $ticket], 201);
    }

    public function mine(Request $request): JsonResponse
    {
        return response()->json([
            'items' => $this->tickets->listTicketsForClient($this->authUser($request)->id),
        ]);
    }

    public function assignedMine(Request $request): JsonResponse
    {
        return response()->json([
            'items' => $this->tickets->listTicketsAssignedToAdmin($this->authUser($request)->id),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $data = $this->tickets->listTicketsForAdmin([
            'status' => $request->query('status'),
            'search' => $request->query('search'),
            'page' => (int) $request->query('page', 1),
            'limit' => (int) $request->query('limit', 20),
        ]);

        return response()->json($data);
    }

    public function assignees(Request $request): JsonResponse
    {
        $ticketId = $request->query('ticketId');
        $ticketId = is_string($ticketId) && $ticketId !== '' ? $ticketId : null;
        $division = $request->query('division');
        $division = is_string($division) && $division !== '' ? $division : null;

        return response()->json($this->tickets->listAssignees($ticketId, $division));
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $ticket = $this->tickets->getTicketById($id);
        $this->tickets->assertTicketAccess($this->authUser($request), $ticket);

        return response()->json(['ticket' => $ticket]);
    }

    public function documentPdf(Request $request, string $id): \Symfony\Component\HttpFoundation\Response
    {
        $ticket = $this->tickets->getTicketById($id);
        $this->tickets->assertTicketAccess($this->authUser($request), $ticket);
        $bytes = app(\App\Services\PdfDocumentService::class)->generateTicketPdf($id);
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', (string) ($ticket['ticketNumber'] ?? 'ticket')).'.pdf';

        return response($bytes, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        return response()->json([
            'ticket' => $this->tickets->approveTicket($this->authUser($request), $id),
        ]);
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|min:1',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        return response()->json([
            'ticket' => $this->tickets->rejectTicket($this->authUser($request), $id, (string) $request->input('reason')),
        ]);
    }

    public function assign(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'assigneeIds' => 'required|array|min:1',
            'assigneeIds.*' => 'string',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        return response()->json([
            'ticket' => $this->tickets->assignTicket($this->authUser($request), $id, $request->input('assigneeIds')),
        ]);
    }

    public function complete(Request $request, string $id): JsonResponse
    {
        return response()->json([
            'ticket' => $this->tickets->completeTicketService($this->authUser($request), $id),
        ]);
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:'.implode(',', self::TICKET_STATUSES),
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        return response()->json([
            'ticket' => $this->tickets->updateTicketStatus($this->authUser($request), $id, (string) $request->input('status')),
        ]);
    }

    public function confirm(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'satisfied' => 'required|boolean',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        return response()->json([
            'ticket' => $this->tickets->clientConfirmResolution(
                $this->authUser($request),
                $id,
                (bool) $request->boolean('satisfied'),
            ),
        ]);
    }

    public function feedback(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'rating' => 'nullable|integer|min:1|max:5',
            'comment' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        return response()->json([
            'ticket' => $this->tickets->submitFeedback($this->authUser($request), $id, [
                'rating' => $request->input('rating'),
                'comment' => $request->input('comment'),
            ]),
        ]);
    }
}
