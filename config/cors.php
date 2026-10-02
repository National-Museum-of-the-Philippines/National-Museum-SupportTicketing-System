<?php

return [
    'paths' => ['api/*', 'uploads/*', 'broadcasting/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['http://nmp-ict.lan:5173', 'http://nmp-ict.lan:8002'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
