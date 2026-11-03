<?php

return [
    'paths' => ['api/*', 'uploads/*', 'broadcasting/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_unique(array_filter(array_merge(
        [
            'http://127.0.0.1:5173',
            'http://localhost:5173',
            'http://on-prem.x-dcb.net:5173',
            'http://on-prem.x-dcb.net:4000',
            'http://on-prem.x-dcb.net:8002',
            'http://127.0.0.1:8002',
            'http://localhost:8002',
            'http://api.nmp-ict.lan:5173',
            'http://api.nmp-ict.lan:8002',
            'http://nmp-ict.lan:5173',
            'http://nmp-ict.lan:8002',
            'http://10.138.21.235:5173',
            'http://10.138.21.235:8002',
            'http://202.90.136.222:5173',
            'http://202.90.136.222:8002',
        ],
        array_map('trim', explode(',', (string) env('CORS_ORIGIN', ''))),
    )))),
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
