<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\FormService;
use App\Services\MyFormsAnalyticsService;
use App\Services\PamanaEmployeeService;
use App\Services\PdfDocumentService;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class FormController extends Controller
{
    public function __construct(
        private FormService $forms,
        private MyFormsAnalyticsService $analytics,
        private PdfDocumentService $pdfs,
        private PamanaEmployeeService $pamana,
    ) {}

    public function published(): JsonResponse
    {
        return response()->json(['items' => $this->forms->listPublishedForms()]);
    }

    public function publishedShow(string $id): JsonResponse
    {
        return response()->json(['form' => $this->forms->getPublishedForm($id)]);
    }

    public function publishedPdf(string $id): Response
    {
        $form = $this->forms->getPublishedForm($id);
        $bytes = $this->pdfs->generateFormPdf($id);
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', (string) ($form['refNumber'] ?? 'form')).'.pdf';

        return response($bytes, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function mineAnalytics(Request $request): JsonResponse
    {
        return response()->json($this->analytics->getMyFormsAnalytics($this->authUser($request)));
    }

    public function mine(Request $request): JsonResponse
    {
        return response()->json(['items' => $this->forms->listMyForms($this->authUser($request))]);
    }

    public function actionOfficerStaff(Request $request): JsonResponse
    {
        $user = User::query()->find($this->authUser($request)->id);
        if (! $user) {
            throw new ApiException(404, 'User not found');
        }

        return response()->json($this->pamana->listActionOfficersForCreator($user));
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['form' => $this->forms->getFormById($id)]);
    }

    public function store(Request $request): JsonResponse
    {
        $form = $this->forms->createForm($this->authUser($request), $request->all());

        return response()->json(['form' => $form], 201);
    }

    public function submitToRecords(Request $request): JsonResponse
    {
        $form = $this->forms->createAndSubmitForReview($this->authUser($request), $request->all());

        return response()->json(['form' => $form], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $form = $this->forms->updateForm($this->authUser($request), $id, $request->all());

        return response()->json(['form' => $form]);
    }

    public function submitForReview(Request $request, string $id): JsonResponse
    {
        $form = $this->forms->submitFormForReview($this->authUser($request), $id);

        return response()->json(['form' => $form]);
    }
}
