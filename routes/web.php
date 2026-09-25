<?php

use App\Http\Controllers\UploadController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'ok' => true,
        'service' => 'nmp-ticketing-api',
        'hint' => 'Use /api/* endpoints',
    ]);
});

/** Stream a stored upload. Local disk or S3, same /uploads/{filename} URL. */
Route::get('/uploads/{filename}', [UploadController::class, 'show'])
    ->where('filename', '[A-Za-z0-9._-]+');
