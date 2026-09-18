<?php

namespace App\Http\Controllers;

use App\Services\RbacService;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RbacController extends Controller
{
    public function __construct(private RbacService $rbac) {}

    public function summary(): JsonResponse
    {
        return response()->json($this->rbac->summary());
    }

    public function roles(): JsonResponse
    {
        return response()->json(['items' => $this->rbac->listRoles()]);
    }

    public function permissions(): JsonResponse
    {
        return response()->json(['items' => $this->rbac->listPermissions()]);
    }

    public function storeRole(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|min:2|max:80',
            'description' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        return response()->json([
            'role' => $this->rbac->createRole(
                (string) $request->input('name'),
                $request->input('description'),
            ),
        ], 201);
    }

    public function updateRole(Request $request, int $roleId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'description' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        return response()->json([
            'role' => $this->rbac->updateRole($roleId, $request->input('description')),
        ]);
    }

    public function destroyRole(int $roleId): JsonResponse
    {
        $this->rbac->deleteRole($roleId);

        return response()->json(['ok' => true]);
    }

    public function syncRolePermissions(Request $request, int $roleId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'permissionIds' => 'present|array',
            'permissionIds.*' => 'integer',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        return response()->json([
            'role' => $this->rbac->syncRolePermissions($roleId, $request->input('permissionIds', [])),
        ]);
    }

    public function employees(Request $request): JsonResponse
    {
        return response()->json($this->rbac->listEmployees([
            'search' => (string) $request->query('search', ''),
            'role' => (string) $request->query('role', ''),
            'access' => (string) $request->query('access', 'all'),
            'page' => (int) $request->query('page', 1),
            'perPage' => (int) $request->query('perPage', 20),
        ]));
    }

    public function syncRoles(Request $request, int $userId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'roleIds' => 'present|array',
            'roleIds.*' => 'integer',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $employee = $this->rbac->syncRoles($userId, $request->input('roleIds', []));

        return response()->json(['employee' => $employee]);
    }
}
