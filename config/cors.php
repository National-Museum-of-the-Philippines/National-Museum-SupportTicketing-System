<?php

return [
    'paths' => ['api/*', 'uploads/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter([
        env('CORS_ORIGIN', 'http://127.0.0.1:5173'),
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ])),
    'allowed_origins_patterns' => [
        '#^http://localhost:\d+$#',
        '#^http://127\.0\.0\.1:\d+$#',
        '#^https?://on-prem\.x-dcb\.net(:\d+)?$#',
        '#^https?://202\.90\.136\.222(:\d+)?$#',
        '#^https?://10\.138\.21\.235(:\d+)?$#',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
