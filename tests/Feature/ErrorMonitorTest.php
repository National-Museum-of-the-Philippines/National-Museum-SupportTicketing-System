<?php

namespace Tests\Feature;

use App\Models\ErrorLog;
use App\Services\ErrorMonitorService;
use App\Support\ApiException;
use App\Support\AuthUser;
use Illuminate\Http\Request;
use Tests\TestCase;

class ErrorMonitorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        (require database_path('migrations/2026_10_02_000000_create_error_logs_table.php'))->up();
    }

    private function user(): AuthUser
    {
        return new AuthUser(id: '42', email: 'sa@example.test', name: 'Super Admin', role: 'super_admin', division: '', designation: '');
    }

    public function test_server_errors_are_recorded_and_repeats_are_counted(): void
    {
        $service = app(ErrorMonitorService::class);
        $request = Request::create('/api/tickets', 'POST');

        $boom = new \RuntimeException('boom');
        $service->recordThrowable($boom, $request);
        $service->recordThrowable($boom, $request);

        $this->assertSame(1, ErrorLog::query()->count());
        $log = ErrorLog::query()->first();
        $this->assertSame(2, $log->occurrences);
        $this->assertSame('server', $log->source);
        $this->assertSame('error', $log->level);
        $this->assertSame('POST', $log->method);
    }

    public function test_distinct_instances_of_the_same_error_are_grouped(): void
    {
        $service = app(ErrorMonitorService::class);
        $make = fn () => new \RuntimeException('same place');

        $service->recordThrowable($make(), Request::create('/api/forms', 'GET'));
        $service->recordThrowable($make(), Request::create('/api/forms', 'GET'));

        $this->assertSame(1, ErrorLog::query()->count());
        $this->assertSame(2, ErrorLog::query()->first()->occurrences);
    }

    public function test_expected_auth_and_not_found_responses_are_ignored(): void
    {
        $service = app(ErrorMonitorService::class);

        $this->assertNull($service->recordThrowable(new ApiException(401, 'Authentication required')));
        $this->assertNull($service->recordThrowable(new ApiException(404, 'Missing')));
        $this->assertNotNull($service->recordThrowable(new ApiException(400, 'Bad input')));

        $this->assertSame('warning', ErrorLog::query()->first()->level);
    }

    public function test_resolving_starts_a_fresh_entry_for_the_next_occurrence(): void
    {
        $service = app(ErrorMonitorService::class);
        $first = $service->recordThrowable(new \RuntimeException('again'));
        $service->resolve($first->id, $this->user());

        $second = $service->recordThrowable(new \RuntimeException('again'));

        $this->assertNotSame($first->id, $second->id);
        $this->assertSame(1, $service->summary()['open']);
        $this->assertSame(1, $service->summary()['resolved']);
    }

    public function test_list_filters_and_hides_traces(): void
    {
        $service = app(ErrorMonitorService::class);
        $service->recordThrowable(new \RuntimeException('database gone'));
        $service->recordThrowable(new ApiException(400, 'bad request'));

        $errors = $service->list(['level' => 'error']);
        $this->assertSame(1, $errors['total']);
        $this->assertArrayNotHasKey('trace', $errors['items'][0]);

        $search = $service->list(['q' => 'database']);
        $this->assertSame(1, $search['total']);
    }

    public function test_error_monitoring_api_requires_a_login(): void
    {
        $this->getJson('/api/super-admin/errors')->assertStatus(401);
        $this->postJson('/api/errors/client', ['message' => 'x'])->assertStatus(401);
    }
}
