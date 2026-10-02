<?php

namespace App\Services;

use App\Support\ApiException;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class UploadService
{
    private const MAX_BYTES = 25 * 1024 * 1024;

    /** Stored files never change under the same name, so browsers may keep them. */
    private const CACHE_CONTROL = 'private, max-age=31536000, immutable';

    /**
     * @return array{filename: string, originalName: string, mimeType: string, size: int, url: string}
     */
    public function store(UploadedFile $file): array
    {
        if (! $file->isValid()) {
            throw new ApiException(400, 'No file uploaded');
        }

        $mime = (string) $file->getMimeType();
        $original = (string) $file->getClientOriginalName();

        if (! $this->isAllowed($mime, $original)) {
            throw new ApiException(400, 'Only PDF or image files are allowed');
        }

        if ($file->getSize() > self::MAX_BYTES) {
            throw new ApiException(400, 'File too large (max 25MB)');
        }

        $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $original) ?: 'file';
        $filename = ((int) (microtime(true) * 1000)).'-'.$safe;

        $disk = $this->disk();

        try {
            $stored = $disk->putFileAs('', $file, $filename);
            if ($stored === false) {
                throw new ApiException(500, 'Could not store the uploaded file');
            }
            $size = (int) $disk->size($filename);
            $this->seedCache($filename, (string) $file->getRealPath());
        } catch (ApiException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->storageFailure('store', $e);
        }

        return [
            'filename' => $filename,
            'originalName' => $original,
            'mimeType' => $mime,
            'size' => $size,
            'url' => '/uploads/'.$filename,
        ];
    }

    /**
     * Serve a stored file. Files on S3 are downloaded once into a local cache and
     * served from disk afterwards, so viewers do not wait on S3 for every request.
     */
    public function responseFor(string $filename): Response
    {
        $safe = basename($filename);
        if ($safe === '' || $safe !== $filename || str_contains($safe, '..')) {
            abort(404);
        }

        $disk = $this->disk();

        try {
            if ($this->usesCache()) {
                $cached = $this->cachedPath($safe, $disk);
                if ($cached === null) {
                    abort(404);
                }

                return response()->file($cached)->setPrivate()->setMaxAge(31536000)->setImmutable();
            }

            if (! $disk->exists($safe)) {
                abort(404);
            }

            return $disk->response($safe, null, ['Cache-Control' => self::CACHE_CONTROL]);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw $this->storageFailure('read', $e);
        }
    }

    public function purge(): int
    {
        $disk = $this->disk();
        $removed = 0;

        foreach ($disk->files() as $path) {
            if (basename($path) === '.gitkeep') {
                continue;
            }
            $disk->delete($path);
            @unlink($this->cacheDir().'/'.basename($path));
            $removed++;
        }

        return $removed;
    }

    /**
     * Download every stored file that is not cached yet.
     *
     * @return array{cached: int, failed: list<string>}
     */
    public function warmCache(): array
    {
        $disk = $this->disk();
        $cached = 0;
        $failed = [];

        if (! $this->usesCache()) {
            return ['cached' => 0, 'failed' => []];
        }

        foreach ($disk->files() as $path) {
            $name = basename($path);
            if ($name === '.gitkeep' || is_file($this->cacheDir().'/'.$name)) {
                continue;
            }
            try {
                $this->cachedPath($name, $disk) !== null ? $cached++ : $failed[] = $name;
            } catch (\Throwable) {
                $failed[] = $name;
            }
        }

        return ['cached' => $cached, 'failed' => $failed];
    }

    /**
     * Human-readable summary of where uploads go (for the check command and logs).
     *
     * @return array{driver: string, bucket: string, region: string, prefix: string, endpoint: string}
     */
    public static function describeDisk(): array
    {
        $cfg = (array) config('filesystems.disks.uploads', []);

        return [
            'driver' => (string) ($cfg['driver'] ?? ''),
            'bucket' => (string) ($cfg['bucket'] ?? ''),
            'region' => (string) ($cfg['region'] ?? ''),
            'prefix' => (string) ($cfg['root'] ?? ''),
            'endpoint' => (string) ($cfg['endpoint'] ?? ''),
        ];
    }

    /**
     * Why the S3 uploads disk cannot be used yet, or null when it looks complete.
     * Access keys may be empty on purpose (IAM role on EC2/ECS), so only the
     * bucket and region are mandatory.
     */
    public static function configurationProblem(): ?string
    {
        $cfg = (array) config('filesystems.disks.uploads', []);
        if (($cfg['driver'] ?? '') !== 's3') {
            return null;
        }

        $missing = [];
        if (empty($cfg['bucket'])) {
            $missing[] = 'AWS_BUCKET';
        }
        if (empty($cfg['region'])) {
            $missing[] = 'AWS_DEFAULT_REGION';
        }
        if (empty($cfg['key']) xor empty($cfg['secret'])) {
            $missing[] = 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (set both or neither)';
        }

        if ($missing === []) {
            return null;
        }

        return 'AWS S3 upload storage is not configured yet: set '.implode(', ', $missing).' in .env';
    }

    private function disk(): Filesystem
    {
        if ($problem = self::configurationProblem()) {
            throw new ApiException(503, $problem);
        }

        return Storage::disk('uploads');
    }

    /** Only remote disks are cached; the local disk already is the file. */
    private function usesCache(): bool
    {
        return config('filesystems.disks.uploads.driver') !== 'local';
    }

    private function cacheDir(): string
    {
        $dir = storage_path('app/uploads-cache');
        if (! is_dir($dir)) {
            // Written by both the web server user and the CLI user.
            @mkdir($dir, 0777, true);
            @chmod($dir, 0777);
        }

        return $dir;
    }

    /** Local copy of a stored file, fetched on first use; null when it does not exist. */
    private function cachedPath(string $filename, Filesystem $disk): ?string
    {
        $target = $this->cacheDir().'/'.$filename;
        if (is_file($target)) {
            return $target;
        }

        if (! $disk->exists($filename)) {
            return null;
        }

        // Download beside the target and rename, so a half-finished file is never served.
        $partial = $target.'.'.bin2hex(random_bytes(4)).'.part';
        $in = $disk->readStream($filename);
        $out = fopen($partial, 'wb');
        try {
            $copied = stream_copy_to_stream($in, $out);
            if ($copied === false || $copied !== (int) $disk->size($filename)) {
                throw new \RuntimeException('Incomplete download of '.$filename);
            }
        } catch (\Throwable $e) {
            @unlink($partial);
            throw $e;
        } finally {
            fclose($out);
            if (is_resource($in)) {
                fclose($in);
            }
        }
        rename($partial, $target);

        return $target;
    }

    private function seedCache(string $filename, string $sourcePath): void
    {
        if ($this->usesCache() && $sourcePath !== '') {
            @copy($sourcePath, $this->cacheDir().'/'.$filename);
        }
    }

    private function storageFailure(string $action, \Throwable $e): ApiException
    {
        Log::error("Upload storage {$action} failed", [
            'disk' => self::describeDisk(),
            'error' => $e->getMessage(),
        ]);

        return new ApiException(503, 'File storage is unavailable: '.$e->getMessage());
    }

    private function isAllowed(string $mime, string $original): bool
    {
        $isPdf = $mime === 'application/pdf' || (bool) preg_match('/\.pdf$/i', $original);
        $isImage = (bool) preg_match('#^image/(png|jpeg|webp)$#i', $mime)
            || (bool) preg_match('/\.(png|jpe?g|webp)$/i', $original);

        return $isPdf || $isImage;
    }
}
