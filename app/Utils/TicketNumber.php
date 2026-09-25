<?php

namespace App\Utils;

final class TicketNumber
{
    public static function generateTicketNumber(): string
    {
        $yr = (int) date('Y');
        $suffix = strtoupper(
            base_convert((string) (int) (microtime(true) * 1000), 10, 36)
            .substr(base_convert((string) random_int(0, 1679615), 10, 36), 0, 3)
        );

        return "TKT-{$yr}-{$suffix}";
    }

    public static function generateFormRef(): string
    {
        $yr = (int) date('Y');
        $suffix = strtoupper(
            base_convert((string) (int) (microtime(true) * 1000), 10, 36)
            .substr(base_convert((string) random_int(0, 1679615), 10, 36), 0, 3)
        );

        return "FRM-{$yr}-{$suffix}";
    }
}
