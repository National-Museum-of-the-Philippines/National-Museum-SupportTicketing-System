<?php

namespace App\Http\Controllers;

use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;

class UploadController extends Controller
{
    private const MAX_BYTES = 25 * 1024 * 1024;

    public function store(Request $request): JsonResponse
    {
        if (! $request->hasFile('file')) {
            throw new ApiException(400, 'No file uploaded');
        }

        $file = $request->file('file');
        if (! $file || ! $file->isValid()) {
            throw new ApiException(400, 'No file uploaded');
        }

        $mime = (string) $file->getMimeType();
        $original = (string) $file->getClientOriginalName();

        if (! $this->isAllowed($mime, $original)) {
            throw new ApiException(400, 'Only PDF or image files are allowed');
        }

        if ($file->getSize() > self::MAX_BYTES) {
            throw new ApiException(400, 'File too large (max 25MB)');
        }

        $dir = $this->uploadDir();
        File::ensureDirectoryExists($dir);

        $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $original) ?: 'file';
        $filename = ((int) (microtime(true) * 1000)).'-'.$safe;
        $file->move($dir, $filename);

        $fullPath = $dir.DIRECTORY_SEPARATOR.$filename;
        $size = is_file($fullPath) ? filesize($fullPath) : 0;

        return response()->json([
            'file' => [
                'filename' => $filename,
                'originalName' => $original,
                'mimeType' => $mime,
                'size' => $size,
                'url' => '/uploads/'.$filename,
            ],
        ], 201);
    }

    /** PDF for forms; images for signatures + rendered print templates. */
    private function isAllowed(string $mime, string $original): bool
    {
        $isPdf = $mime === 'application/pdf' || (bool) preg_match('/\.pdf$/i', $original);
        $isImage = (bool) preg_match('#^image/(png|jpeg|webp)$#i', $mime)
            || (bool) preg_match('/\.(png|jpe?g|webp)$/i', $original);

        return $isPdf || $isImage;
    }

    private function uploadDir(): string
    {
        $configured = env('UPLOAD_DIR');
        if (is_string($configured) && $configured !== '') {
            return $configured;
        }

        return base_path('../backend/uploads');
    }
}
