<?php

namespace App\Services;

use App\Models\ErrorLog;
use App\Support\ApiException;
use App\Support\AuthUser;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * Error Monitoring for Super Admin: records application failures (server
 * exceptions, browser errors, console errors) and serves the review API.
 *
 * Recording never throws — a broken monitor must not break the request.
 */
class ErrorMonitorService
{
    public const SOURCE_SERVER = 'server';

    public const SOURCE_CLIENT = 'client';

    public const SOURCE_CONSOLE = 'console';

    public const LEVEL_ERROR = 'error';

    public const LEVEL_WARNING = 'warning';

    private const TRACE_LIMIT = 12000;

    private const MESSAGE_LIMIT = 2000;

    /** Expected request outcomes: not failures worth a monitoring entry. */
    private const IGNORED_STATUSES = [401, 403, 404, 419, 422, 429];

    public function recordThrowable(\Throwable $e, ?Request $request = null): ?ErrorLog
    {
        try {
            $status = $this->statusOf($e);
            if ($status !== null && $status < 500 && in_array($status, self::IGNORED_STATUSES, true)) {
                return null;
            }

            // Artisan/queue context has no real request. PHPUnit also "runs in console", so
            // a request passed in explicitly always counts as a server-side failure.
            $console = $request === null || (app()->runningInConsole() && ! app()->runningUnitTests());
            $user = $request?->attributes->get('authUser');
            $user = $user instanceof AuthUser ? $user : null;
            $message = $e->getMessage() !== '' ? $e->getMessage() : get_class($e);

            return $this->store([
                'source' => $console ? self::SOURCE_CONSOLE : self::SOURCE_SERVER,
                'level' => $status !== null && $status < 500 ? self::LEVEL_WARNING : self::LEVEL_ERROR,
                'status' => $status,
                'message' => Str::limit($message, self::MESSAGE_LIMIT, ''),
                'exception' => get_class($e),
                'file' => $this->relativePath($e->getFile()),
                'line' => $e->getLine(),
                'trace' => Str::limit($e->getTraceAsString(), self::TRACE_LIMIT, "\n…"),
                'method' => $console ? null : $request?->getMethod(),
                'url' => $console
                    ? Str::limit(implode(' ', $_SERVER['argv'] ?? ['artisan']), 1000, '')
                    : ($request ? Str::limit($request->fullUrl(), 2000, '') : null),
                'user_id' => $user?->id,
                'user_name' => $user?->name,
                'user_role' => $user?->role,
                'ip' => $console ? null : $request?->ip(),
                'user_agent' => $console ? null : Str::limit((string) $request?->userAgent(), 512, ''),
            ]);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param  array{message: string, stack?: string|null, url?: string|null, kind?: string|null, component?: string|null}  $data
     */
    public function recordClient(array $data, ?AuthUser $user, Request $request): ?ErrorLog
    {
        try {
            $kind = (string) ($data['kind'] ?? 'error');

            return $this->store([
                'source' => self::SOURCE_CLIENT,
                'level' => self::LEVEL_ERROR,
                'status' => null,
                'message' => Str::limit(trim($data['message']), self::MESSAGE_LIMIT, ''),
                'exception' => Str::limit($kind.(! empty($data['component']) ? ' @ '.$data['component'] : ''), 255, ''),
                'file' => null,
                'line' => null,
                'trace' => isset($data['stack']) ? Str::limit((string) $data['stack'], self::TRACE_LIMIT, "\n…") : null,
                'method' => null,
                'url' => isset($data['url']) ? Str::limit((string) $data['url'], 2000, '') : null,
                'user_id' => $user?->id,
                'user_name' => $user?->name,
                'user_role' => $user?->role,
                'ip' => $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 512, ''),
            ]);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param  array{status?: string|null, level?: string|null, source?: string|null, q?: string|null, page?: int|string|null, perPage?: int|string|null}  $filters
     * @return array{items: list<array<string, mixed>>, total: int, page: int, perPage: int}
     */
    public function list(array $filters): array
    {
        $perPage = max(1, min(100, (int) ($filters['perPage'] ?? 25)));
        $page = max(1, (int) ($filters['page'] ?? 1));

        $query = ErrorLog::query();

        match ($filters['status'] ?? 'open') {
            'resolved' => $query->whereNotNull('resolved_at'),
            'all' => null,
            default => $query->whereNull('resolved_at'),
        };

        if (! empty($filters['level'])) {
            $query->where('level', $filters['level']);
        }
        if (! empty($filters['source'])) {
            $query->where('source', $filters['source']);
        }
        if (! empty($filters['q'])) {
            $term = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim((string) $filters['q'])).'%';
            $query->where(function ($w) use ($term) {
                $w->where('message', 'like', $term)
                    ->orWhere('exception', 'like', $term)
                    ->orWhere('url', 'like', $term)
                    ->orWhere('file', 'like', $term)
                    ->orWhere('user_name', 'like', $term);
            });
        }

        $total = (clone $query)->count();
        $items = $query
            ->orderByDesc('last_seen_at')
            ->forPage($page, $perPage)
            ->get()
            ->map(fn (ErrorLog $log) => $log->toApiArray([], ['trace']))
            ->all();

        return ['items' => $items, 'total' => $total, 'page' => $page, 'perPage' => $perPage];
    }

    /**
     * @return array{open: int, openErrors: int, openWarnings: int, last24h: int, resolved: int, bySource: array<string, int>, lastSeenAt: string|null}
     */
    public function summary(): array
    {
        $open = ErrorLog::query()->whereNull('resolved_at');
        $bySource = (clone $open)
            ->selectRaw('source, COUNT(*) as total')
            ->groupBy('source')
            ->pluck('total', 'source')
            ->map(fn ($v) => (int) $v)
            ->all();

        $last = ErrorLog::query()->max('last_seen_at');

        return [
            'open' => (clone $open)->count(),
            'openErrors' => (clone $open)->where('level', self::LEVEL_ERROR)->count(),
            'openWarnings' => (clone $open)->where('level', self::LEVEL_WARNING)->count(),
            'last24h' => ErrorLog::query()->where('last_seen_at', '>=', Carbon::now()->subDay())->count(),
            'resolved' => ErrorLog::query()->whereNotNull('resolved_at')->count(),
            'bySource' => $bySource,
            'lastSeenAt' => $last ? Carbon::parse($last)->format('c') : null,
        ];
    }

    /** @return array<string, mixed> */
    public function find(string $id): array
    {
        return $this->mustFind($id)->toApiArray();
    }

    /** @return array<string, mixed> */
    public function resolve(string $id, AuthUser $by): array
    {
        $log = $this->mustFind($id);
        $log->resolved_at = Carbon::now();
        $log->resolved_by = $by->name;
        $log->save();

        return $log->toApiArray();
    }

    /** @return array<string, mixed> */
    public function reopen(string $id): array
    {
        $log = $this->mustFind($id);
        $log->resolved_at = null;
        $log->resolved_by = null;
        $log->save();

        return $log->toApiArray();
    }

    public function delete(string $id): void
    {
        $this->mustFind($id)->delete();
    }

    public function resolveAll(AuthUser $by): int
    {
        return ErrorLog::query()->whereNull('resolved_at')->update([
            'resolved_at' => Carbon::now(),
            'resolved_by' => $by->name,
        ]);
    }

    /** @param  'resolved'|'all'  $scope */
    public function purge(string $scope): int
    {
        $query = ErrorLog::query();
        if ($scope !== 'all') {
            $query->whereNotNull('resolved_at');
        }

        return $query->delete();
    }

    /** @param  array<string, mixed>  $attrs */
    private function store(array $attrs): ErrorLog
    {
        $now = Carbon::now();
        $attrs['fingerprint'] = sha1(implode('|', [
            $attrs['source'],
            (string) $attrs['exception'],
            Str::limit((string) $attrs['message'], 300, ''),
            (string) $attrs['file'],
            (string) $attrs['line'],
        ]));

        $existing = ErrorLog::query()
            ->where('fingerprint', $attrs['fingerprint'])
            ->whereNull('resolved_at')
            ->orderByDesc('last_seen_at')
            ->first();

        if ($existing) {
            $existing->fill([
                'occurrences' => $existing->occurrences + 1,
                'last_seen_at' => $now,
                'url' => $attrs['url'],
                'method' => $attrs['method'],
                'user_id' => $attrs['user_id'],
                'user_name' => $attrs['user_name'],
                'user_role' => $attrs['user_role'],
                'ip' => $attrs['ip'],
                'user_agent' => $attrs['user_agent'],
                'trace' => $attrs['trace'] ?? $existing->trace,
            ]);
            $existing->save();

            return $existing;
        }

        return ErrorLog::create($attrs + [
            'occurrences' => 1,
            'first_seen_at' => $now,
            'last_seen_at' => $now,
        ]);
    }

    private function mustFind(string $id): ErrorLog
    {
        $log = ErrorLog::query()->find($id);
        if (! $log) {
            throw new ApiException(404, 'Error entry not found');
        }

        return $log;
    }

    private function statusOf(\Throwable $e): ?int
    {
        if ($e instanceof ApiException) {
            return (int) $e->status;
        }
        if ($e instanceof HttpExceptionInterface) {
            return $e->getStatusCode();
        }

        return null;
    }

    private function relativePath(string $path): string
    {
        $base = rtrim(base_path(), DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR;

        return str_starts_with($path, $base) ? substr($path, strlen($base)) : $path;
    }
}
