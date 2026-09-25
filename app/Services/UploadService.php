<?php

namespace App\Services;

use App\Support\ApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class UploadService
{
    private const MAX_BYTES = 25 * 1024 * 1024;

    /**
     * @return array{filename: string, originalName: string, mimeType: string, size: int, url: string}
     */
    public function store(UploadedFile $file): array
    {
        if (! $file->isValid()) {
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

        $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $original) ?: 'file';
        $filename = ((int) (microtime(true) * 1000)).'-'.$safe;

        $disk = Storage::disk('uploads');
        $stored = $disk->putFileAs('', $file, $filename);
        if ($stored === false) {
            throw new ApiException(500, 'Could not store the uploaded file');
        }

        return [
            'filename' => $filename,
            'originalName' => $original,
            'mimeType' => $mime,
            'size' => (int) $disk->size($filename),
            'url' => '/uploads/'.$filename,
        ];
    }

    public function responseFor(string $filename): StreamedResponse
    {
        $safe = basename($filename);
        if ($safe === '' || $safe !== $filename || str_contains($safe, '..')) {
            abort(404);
        }

        $disk = Storage::disk('uploads');
        if (! $disk->exists($safe)) {
            abort(404);
        }

        return $disk->response($safe);
    }

    public function purge(): int
    {
        $disk = Storage::disk('uploads');
        $removed = 0;

        foreach ($disk->files() as $path) {
            if (basename($path) === '.gitkeep') {
                continue;
            }
            $disk->delete($path);
            $removed++;
        }

        return $removed;
    }

    private function isAllowed(string $mime, string $original): bool
    {
        $isPdf = $mime === 'application/pdf' || (bool) preg_match('/\.pdf$/i', $original);
        $isImage = (bool) preg_match('#^image/(png|jpeg|webp)$#i', $mime)
            || (bool) preg_match('/\.(png|jpe?g|webp)$/i', $original);

        return $isPdf || $isImage;
    }
}
