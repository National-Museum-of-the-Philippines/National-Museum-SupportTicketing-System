<?php

namespace App\Http\Controllers;

use App\Services\FormReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FormReportController extends Controller
{
    public function __construct(private FormReportService $reports) {}

    public function forms(Request $request): JsonResponse
    {
        return response()->json([
            'items' => $this->reports->formList($this->authUser($request), (string) $request->query('search', '')),
        ]);
    }

    public function report(Request $request, string $formId): JsonResponse
    {
        return response()->json($this->reports->report(
            $this->authUser($request),
            $formId,
            $request->query('from'),
            $request->query('to'),
            $request->boolean('closedOnly'),
        ));
    }

    public function closed(Request $request, string $formId): JsonResponse
    {
        return response()->json($this->reports->closedTickets(
            $this->authUser($request),
            $formId,
            $request->query('from'),
            $request->query('to'),
        ));
    }

    public function settings(Request $request, string $formId): JsonResponse
    {
        return response()->json($this->reports->reportSettings($this->authUser($request), $formId));
    }

    public function saveSettings(Request $request, string $formId): JsonResponse
    {
        $data = $request->validate(['fields' => ['required', 'array'], 'fields.*' => ['string']]);

        return response()->json($this->reports->saveReportSettings($this->authUser($request), $formId, $data['fields']));
    }

    public function dynamic(Request $request, string $formId): JsonResponse
    {
        return response()->json($this->reports->dynamicReport(
            $this->authUser($request),
            $formId,
            $request->query('from'),
            $request->query('to'),
        ));
    }

    public function requests(Request $request, string $formId): JsonResponse
    {
        return response()->json($this->reports->requests($this->authUser($request), $formId, $request->query()));
    }
}
