<?php

namespace App\Services;

use App\Models\Poke;
use App\Models\User;
use App\Support\ApiException;
use App\Support\AuthUser;

class PokeService
{
    private const POKE_COOLDOWN_MS = 30000;

    public function __construct(
        private ConversationService $conversations,
        private RealtimeService $realtime,
        private PamanaEmployeeService $pamana,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function sendPoke(AuthUser $user, string $toUserId): array
    {
        if ($toUserId === $user->id) {
            throw new ApiException(400, 'You cannot poke yourself');
        }

        $target = User::query()->where('id', $toUserId)->where('active', true)->first();
        if (! $target) {
            throw new ApiException(404, 'User not found');
        }

        $recent = Poke::query()
            ->where('from_user_id', $user->id)
            ->where('to_user_id', $toUserId)
            ->where('created_at', '>=', now()->subMilliseconds(self::POKE_COOLDOWN_MS))
            ->orderByDesc('created_at')
            ->first();

        if ($recent) {
            throw new ApiException(429, 'Please wait before poking again');
        }

        $data = $this->conversations->getOrCreateDirectConversation($user, $toUserId);
        $conversationId = (string) $data['conversation']['_id'];

        $this->realtime->refreshUserConversationRooms($user->id);
        $this->realtime->refreshUserConversationRooms($toUserId);

        $poke = Poke::create([
            'from_user_id' => $user->id,
            'to_user_id' => $toUserId,
            'conversation_id' => $conversationId,
        ]);

        $payload = [
            '_id' => (string) $poke->id,
            'fromUserId' => $user->id,
            'fromUserName' => $this->displayName(User::query()->find($user->id)) ?: $user->name,
            'fromUserRole' => $user->role,
            'toUserId' => $toUserId,
            'conversationId' => $conversationId,
            'createdAt' => optional($poke->created_at)?->toISOString() ?? now()->toISOString(),
        ];

        $this->realtime->emitPoke($toUserId, $payload);

        return $payload;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listRecentPokes(AuthUser $user, int $limit = 8): array
    {
        return Poke::query()
            ->with('fromUser')
            ->where('to_user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(function (Poke $p) {
                $from = $p->fromUser;

                return [
                    '_id' => (string) $p->id,
                    'fromUserId' => $from ? (string) $from->id : (string) $p->from_user_id,
                    'fromUserName' => $this->displayName($from) ?: 'Someone',
                    'fromUserRole' => $from?->role ?? '',
                    'toUserId' => (string) $p->to_user_id,
                    'conversationId' => $p->conversation_id ? (string) $p->conversation_id : null,
                    'createdAt' => optional($p->created_at)?->toISOString(),
                ];
            })
            ->all();
    }

    /** The name as PAMANA has it (or the one the person saved in Settings). */
    private function displayName(?User $user): string
    {
        if (! $user) {
            return '';
        }

        return trim((string) ($this->pamana->enrichPublicUser($user)['name'] ?? '')) ?: (string) $user->name;
    }
}
