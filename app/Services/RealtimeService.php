<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Best-effort HTTP bridge to the socket.io sidecar (port 4001).
 * Messages still persist if the sidecar is down.
 */
class RealtimeService
{
    /**
     * @param  array{conversationId: string, message: array<string, mixed>}  $payload
     */
    public function emitNewMessage(array $payload): void
    {
        $this->post('/internal/emit/message', $payload);
    }

    /**
     * @param  array{conversationId: string, lastMessageAt: string, lastMessagePreview: string, lastSenderName: string}  $payload
     */
    public function emitConversationUpdate(array $payload): void
    {
        $this->post('/internal/emit/conversation-update', $payload);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function emitPoke(string $targetUserId, array $payload): void
    {
        $this->post('/internal/emit/poke', [
            'targetUserId' => $targetUserId,
            'payload' => $payload,
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function emitMention(string $targetUserId, array $payload): void
    {
        $this->post('/internal/emit/mention', [
            'targetUserId' => $targetUserId,
            'payload' => $payload,
        ]);
    }

    /**
     * Bell / toast updates for tickets and forms (not chat).
     *
     * @param  array<string, mixed>  $payload
     * @param  list<string>  $userIds
     * @param  list<string>  $roles
     */
    public function emitNotification(array $payload, array $userIds = [], array $roles = []): void
    {
        if ($userIds === [] && $roles === []) {
            return;
        }

        $this->post('/internal/emit/notification', [
            'userIds' => array_values(array_filter($userIds)),
            'roles' => array_values(array_filter($roles)),
            'payload' => $payload,
        ]);
    }

    public function refreshUserConversationRooms(string $userId): void
    {
        $this->post('/internal/refresh-rooms', ['userId' => $userId]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function post(string $path, array $payload): void
    {
        $base = rtrim((string) config('nmp.realtime_url'), '/');
        if ($base === '') {
            return;
        }

        try {
            Http::timeout(2)
                ->withHeaders([
                    'X-Internal-Secret' => (string) config('nmp.realtime_internal_secret'),
                ])
                ->post($base.$path, $payload);
        } catch (\Throwable $e) {
            Log::debug('Realtime notify failed: '.$e->getMessage());
        }
    }
}
