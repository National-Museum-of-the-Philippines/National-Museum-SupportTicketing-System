<?php

namespace App\Console\Commands;

use App\Services\UploadService;
use Illuminate\Console\Command;

class NmpUploadsWarmCommand extends Command
{
    protected $signature = 'nmp:uploads-warm';

    protected $description = 'Download stored uploads from S3 into the local cache so viewers open quickly';

    public function handle(UploadService $uploads): int
    {
        $result = $uploads->warmCache();

        $this->info("Cached {$result['cached']} file(s).");
        foreach ($result['failed'] as $name) {
            $this->warn("  failed: {$name}");
        }

        return $result['failed'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
