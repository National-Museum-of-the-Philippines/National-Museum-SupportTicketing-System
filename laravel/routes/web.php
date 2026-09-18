<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'ok' => true,
        'service' => 'nmp-ticketing-api',
        'hint' => 'Use /api/* endpoints',
    ]);
});

/** Serve shared upload directory (same files as Express backend/uploads). */
Route::get('/uploads/{filename}', function (string $filename) {
    $safe = basename($filename);
    if ($safe === '' || $safe !== $filename || str_contains($safe, '..')) {
        abort(404);
    }

    $dir = env('UPLOAD_DIR') ?: base_path('../backend/uploads');
    $path = rtrim((string) $dir, '/\\').DIRECTORY_SEPARATOR.$safe;
    if (! is_file($path)) {
        abort(404);
    }

    return response()->file($path);
})->where('filename', '[A-Za-z0-9._-]+');
