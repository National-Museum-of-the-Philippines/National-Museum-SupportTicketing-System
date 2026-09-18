<?php

namespace App\Support;

use Exception;

class ApiException extends Exception
{
    public function __construct(
        public readonly int $status,
        string $message,
    ) {
        parent::__construct($message, $status);
    }
}
