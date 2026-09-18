<?php

namespace App\Services;

use App\Support\ApiException;

class TemplateEmbedService
{
    /**
     * TODO: Embed uploaded template with field placements into a PDF document.
     *
     * @param  array<int, array{variable: string, label: string, xPct: float, yPct: float}>  $placements
     * @param  array<string, string>  $values
     * @param  array{emptyFallbackToLabel?: bool, imageValues?: array<string, string>}  $options
     *
     * @throws ApiException
     */
    public function embedTemplateWithPlacements(
        mixed $pdfDoc,
        string $templatePath,
        array $placements,
        array $values,
        float $fontSize,
        array $options = [],
    ): bool {
        throw new ApiException(501, 'PDF template embedding pending');
    }
}
