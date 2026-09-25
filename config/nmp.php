<?php

return [

    'jwt_secret' => env('JWT_SECRET', 'change-me-in-production-nmp-ticketing'),

    'realtime_url' => env('REALTIME_URL', ''),

    'realtime_internal_secret' => env('REALTIME_INTERNAL_SECRET', env('JWT_SECRET', '')),

];
