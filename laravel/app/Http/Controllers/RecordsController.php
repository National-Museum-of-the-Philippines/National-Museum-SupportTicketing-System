<?php

namespace App\Http\Controllers;

use App\Services\ActivityService;
use App\Services\FormService;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RecordsController extends Controller
{
    public function __construct(
        private FormService $forms,
        private ActivityService $activity,
    ) {}

    public function dashboard(): JsonResponse
    {
        $pending = $this->forms->listFormsForRecords(['status' => 'pending_review', 'limit' => 5]);
        $published = $this->forms->listFormsForRecords(['status' => 'published', 'limit' => 5]);
        $activities = $this->activity->listRecentActivities(10);

        return response()->json([
            'pendingCount' => $pending['pendingCount'],
            'publishedCount' => $published['total'],
            'recentPending' => $pending['items'],
            'recentPublished' => $published['items'],
            'activities' => $activities,
        ]);
    }

    public function forms(Request $request): JsonResponse
    {
        $data = $this->forms->listFormsForRecords([
            'status' => $request->query('status'),
            'search' => $request->query('search'),
            'page' => (int) $request->query('page', 1),
            'limit' => (int) $request->query('limit', 20),
        ]);

        return response()->json($data);
    }

    public function formShow(string $id): JsonResponse
    {
        return response()->json(['form' => $this->forms->getFormById($id)]);
    }

    public function formPdf(string $id): \Symfony\Component\HttpFoundation\Response
    {
        $form = $this->forms->getFormById($id);
        $bytes = app(\App\Services\PdfDocumentService::class)->generateFormPdf($id);
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', (string) ($form['refNumber'] ?? 'form')).'.pdf';

        return response($bytes, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function review(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'decision' => 'required|in:approved,disapproved',
            'remarks' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $form = $this->forms->reviewForm($this->authUser($request), $id, [
            'decision' => $request->input('decision'),
            'remarks' => $request->input('remarks'),
        ]);

        return response()->json(['form' => $form]);
    }

    public function activity(Request $request): JsonResponse
    {
        $items = $this->activity->listRecentActivities((int) $request->query('limit', 30));

        return response()->json(['items' => $items]);
    }
}
