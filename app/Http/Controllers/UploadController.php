<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUploadRequest;
use App\Services\UploadService;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UploadController extends Controller
{
    public function store(StoreUploadRequest $request, UploadService $uploads): JsonResponse
    {
        $file = $request->file('file');
        if (! $file instanceof UploadedFile) {
            throw new ApiException(400, 'No file uploaded');
        }

        return response()->json([
            'file' => $uploads->store($file),
        ], 201);
    }

    public function show(string $filename, UploadService $uploads): StreamedResponse
    {
        return $uploads->responseFor($filename);
    }
}
