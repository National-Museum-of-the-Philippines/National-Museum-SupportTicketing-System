<?php

namespace App\Services;

use App\Support\ApiException;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;

class PdfDocumentService
{
    public function generateFormPdf(string $formId): string
    {
        return $this->runWorker('form', $formId);
    }

    public function generateTicketPdf(string $ticketId): string
    {
        return $this->runWorker('ticket', $ticketId);
    }

    private function runWorker(string $kind, string $id): string
    {
        $backendRoot = base_path('../backend');
        $script = $backendRoot.'/src/cli/generate-pdf.ts';
        if (! is_file($script)) {
            throw new ApiException(500, 'PDF worker script is missing');
        }

        $outPath = sys_get_temp_dir().'/nmp-pdf-'.Str::uuid()->toString().'.pdf';
        $bun = trim((string) shell_exec('command -v bun')) ?: 'bun';

        $result = Process::path($backendRoot)
            ->timeout(90)
            ->run([
                $bun,
                $script,
                $kind,
                $id,
                $outPath,
            ]);

        if (! $result->successful()) {
            $stderr = trim($result->errorOutput() ?: $result->output());
            if (is_file($outPath)) {
                @unlink($outPath);
            }

            $message = $stderr !== '' ? $stderr : 'PDF generation failed';
            $status = str_contains(strtolower($message), 'not found') ? 404 : 500;
            throw new ApiException($status, $message);
        }

        if (! is_file($outPath)) {
            throw new ApiException(500, 'PDF worker did not write an output file');
        }

        $bytes = file_get_contents($outPath);
        @unlink($outPath);

        if ($bytes === false || $bytes === '') {
            throw new ApiException(500, 'Generated PDF was empty');
        }

        return $bytes;
    }
}
