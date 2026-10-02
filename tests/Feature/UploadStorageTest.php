<?php

namespace Tests\Feature;

use App\Services\UploadService;
use App\Support\ApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UploadStorageTest extends TestCase
{
    public function test_store_writes_the_uploads_disk_and_keeps_the_public_path(): void
    {
        Storage::fake('uploads');

        $file = UploadedFile::fake()->create('request.pdf', 12, 'application/pdf');
        $stored = app(UploadService::class)->store($file);

        Storage::disk('uploads')->assertExists($stored['filename']);
        $this->assertSame('/uploads/'.$stored['filename'], $stored['url']);
        $this->assertSame('request.pdf', $stored['originalName']);
    }

    public function test_store_rejects_a_disallowed_type(): void
    {
        Storage::fake('uploads');

        $file = UploadedFile::fake()->create('notes.txt', 4, 'text/plain');

        $this->expectException(ApiException::class);
        app(UploadService::class)->store($file);
    }

    public function test_show_streams_a_stored_file(): void
    {
        Storage::fake('uploads');
        Storage::disk('uploads')->put('form.pdf', '%PDF-1.4');

        $response = $this->get('/uploads/form.pdf');
        $response->assertOk();
        $this->assertSame('%PDF-1.4', $response->streamedContent());
    }

    public function test_show_missing_file_is_not_found(): void
    {
        Storage::fake('uploads');

        $this->get('/uploads/missing.pdf')->assertNotFound();
    }

    public function test_store_fails_clearly_when_s3_is_not_configured(): void
    {
        config(['filesystems.disks.uploads' => [
            'driver' => 's3',
            'key' => '',
            'secret' => '',
            'region' => '',
            'bucket' => '',
        ]]);

        $file = UploadedFile::fake()->create('request.pdf', 12, 'application/pdf');

        try {
            app(UploadService::class)->store($file);
            $this->fail('Expected an ApiException');
        } catch (ApiException $e) {
            $this->assertSame(503, $e->status);
            $this->assertStringContainsString('AWS_BUCKET', $e->getMessage());
            $this->assertStringContainsString('AWS_DEFAULT_REGION', $e->getMessage());
        }
    }

    public function test_s3_with_bucket_and_region_but_no_keys_is_accepted_as_iam_role(): void
    {
        config(['filesystems.disks.uploads' => [
            'driver' => 's3',
            'key' => '',
            'secret' => '',
            'region' => 'ap-southeast-1',
            'bucket' => 'nmp-uploads',
        ]]);

        $this->assertNull(UploadService::configurationProblem());
    }

    public function test_s3_with_only_one_access_key_value_is_reported(): void
    {
        config(['filesystems.disks.uploads' => [
            'driver' => 's3',
            'key' => 'AKIA-example',
            'secret' => '',
            'region' => 'ap-southeast-1',
            'bucket' => 'nmp-uploads',
        ]]);

        $this->assertStringContainsString('AWS_SECRET_ACCESS_KEY', (string) UploadService::configurationProblem());
    }
}
