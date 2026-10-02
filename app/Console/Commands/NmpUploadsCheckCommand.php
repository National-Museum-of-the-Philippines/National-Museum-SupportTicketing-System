<?php

namespace App\Console\Commands;

use App\Services\UploadService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Verify the uploads disk end to end: write a probe object, read it back, delete it.
 * Run this after filling in the AWS_* values in .env.
 */
class NmpUploadsCheckCommand extends Command
{
    protected $signature = 'nmp:uploads-check';

    protected $description = 'Check that the uploads disk (AWS S3) is configured and writable';

    public function handle(): int
    {
        $info = UploadService::describeDisk();
        $this->line('Uploads disk: '.($info['driver'] ?: '(none)'));
        if ($info['driver'] === 's3') {
            $this->line('  bucket:   '.($info['bucket'] ?: '(not set)'));
            $this->line('  region:   '.($info['region'] ?: '(not set)'));
            $this->line('  prefix:   '.($info['prefix'] ?: '(root)'));
            if ($info['endpoint'] !== '') {
                $this->line('  endpoint: '.$info['endpoint']);
            }
        }

        if ($problem = UploadService::configurationProblem()) {
            $this->error($problem);

            return self::FAILURE;
        }

        $probe = '.nmp-uploads-check-'.Str::lower(Str::random(8)).'.txt';
        $payload = 'nmp uploads check '.now()->toIso8601String();

        try {
            $disk = Storage::disk('uploads');
            $disk->put($probe, $payload);
            $readBack = (string) $disk->get($probe);
            $disk->delete($probe);
        } catch (\Throwable $e) {
            $this->error('Uploads disk is not usable: '.$e->getMessage());

            return self::FAILURE;
        }

        if ($readBack !== $payload) {
            $this->error('Probe object read back with different content.');

            return self::FAILURE;
        }

        $this->info('Uploads disk OK: wrote, read, and deleted a probe object.');

        return self::SUCCESS;
    }
}
