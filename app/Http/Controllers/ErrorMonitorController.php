<?php

namespace App\Http\Controllers;

use App\Services\ErrorMonitorService;
use App\Support\ApiException;
use App\Support\AuthUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Super Admin → Error Monitoring. Routes are gated by role:super_admin. */
class ErrorMonitorController extends Controller
{
    public function __construct(private ErrorMonitorService $errors) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->errors->list([
            'status' => $request->query('status'),
            'level' => $request->query('level'),
            'source' => $request->query('source'),
            'q' => $request->query('q'),
            'page' => $request->query('page'),
            'perPage' => $request->query('perPage'),
        ]));
    }

    public function summary(): JsonResponse
    {
        return response()->json($this->errors->summary());
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(['item' => $this->errors->find($id)]);
    }

    public function resolve(Request $request, string $id): JsonResponse
    {
        return response()->json(['item' => $this->errors->resolve($id, $this->user($request))]);
    }

    public function reopen(string $id): JsonResponse
    {
        return response()->json(['item' => $this->errors->reopen($id)]);
    }

    public function destroy(string $id): JsonResponse
    {
        $this->errors->delete($id);

        return response()->json(['ok' => true]);
    }

    public function resolveAll(Request $request): JsonResponse
    {
        return response()->json(['updated' => $this->errors->resolveAll($this->user($request))]);
    }

    public function purge(Request $request): JsonResponse
    {
        $scope = (string) $request->input('scope', 'resolved');
        if (! in_array($scope, ['resolved', 'all'], true)) {
            throw new ApiException(400, 'scope must be "resolved" or "all"');
        }

        return response()->json(['removed' => $this->errors->purge($scope)]);
    }

    /** Browser-side errors, reported by any signed-in user (throttled). */
    public function reportClient(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'stack' => ['nullable', 'string', 'max:12000'],
            'url' => ['nullable', 'string', 'max:2000'],
            'kind' => ['nullable', 'string', 'max:40'],
            'component' => ['nullable', 'string', 'max:120'],
        ]);

        $user = $request->attributes->get('authUser');
        $this->errors->recordClient($data, $user instanceof AuthUser ? $user : null, $request);

        return response()->json(['ok' => true], 202);
    }

    private function user(Request $request): AuthUser
    {
        $user = $request->attributes->get('authUser');
        if (! $user instanceof AuthUser) {
            throw new ApiException(401, 'Authentication required');
        }

        return $user;
    }
}
