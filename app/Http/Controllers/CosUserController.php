<?php

namespace App\Http\Controllers;

use App\Services\CosUserService;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CosUserController extends Controller
{
    public function __construct(private CosUserService $cosUsers) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->cosUsers->list($this->authUser($request)));
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email|max:190',
            'name' => 'required|string|min:2|max:120',
            'designation' => 'required|string|min:2|max:120',
            'password' => 'required|string|min:8|max:100|confirmed',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $user = $this->cosUsers->create($this->authUser($request), $request->only(['email', 'name', 'designation', 'password']));

        return response()->json(['user' => $user], 201);
    }

    public function setActive(Request $request, string $userId): JsonResponse
    {
        $validator = Validator::make($request->all(), ['active' => 'required|boolean']);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        return response()->json([
            'user' => $this->cosUsers->setActive($this->authUser($request), $userId, $request->boolean('active')),
        ]);
    }
}
