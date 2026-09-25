<?php

namespace App\Http\Controllers;

use App\Services\ConversationService;
use App\Services\PokeService;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class MessageController extends Controller
{
    public function __construct(
        private ConversationService $conversations,
        private PokeService $pokes,
    ) {}

    public function users(Request $request): JsonResponse
    {
        return response()->json([
            'users' => $this->conversations->listMessageableUsers($this->authUser($request)),
        ]);
    }

    public function conversations(Request $request): JsonResponse
    {
        return response()->json([
            'items' => $this->conversations->listConversations($this->authUser($request)),
        ]);
    }

    public function direct(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'userId' => 'required|string|min:1',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $data = $this->conversations->getOrCreateDirectConversation(
            $this->authUser($request),
            (string) $request->input('userId'),
        );

        return response()->json($data, 201);
    }

    public function poke(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'userId' => 'required|string|min:1',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $poke = $this->pokes->sendPoke($this->authUser($request), (string) $request->input('userId'));

        return response()->json(['poke' => $poke], 201);
    }

    public function recentPokes(Request $request): JsonResponse
    {
        return response()->json([
            'items' => $this->pokes->listRecentPokes($this->authUser($request)),
        ]);
    }

    public function ticketConversation(Request $request, string $ticketId): JsonResponse
    {
        return response()->json(
            $this->conversations->getTicketConversation($this->authUser($request), $ticketId),
        );
    }

    public function mentionable(Request $request, string $id): JsonResponse
    {
        return response()->json([
            'users' => $this->conversations->listMentionableUsers($this->authUser($request), $id),
        ]);
    }

    public function messages(Request $request, string $id): JsonResponse
    {
        return response()->json([
            'items' => $this->conversations->listConversationMessages($this->authUser($request), $id),
        ]);
    }

    public function postMessage(Request $request, string $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'body' => 'required|string|min:1|max:4000',
            'mentionIds' => 'nullable|array',
            'mentionIds.*' => 'string',
        ]);
        if ($validator->fails()) {
            throw new ApiException(422, $validator->errors()->first());
        }

        $message = $this->conversations->postConversationMessage(
            $this->authUser($request),
            $id,
            (string) $request->input('body'),
            $request->input('mentionIds', []) ?? [],
        );

        return response()->json(['message' => $message], 201);
    }
}
