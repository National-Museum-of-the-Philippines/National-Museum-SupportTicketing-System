<?php

namespace App\Services;

use App\Events\RealtimeBroadcast;
use App\Models\Conversation;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Support\Facades\Log;

/**
 * Publishes live updates through Laravel Reverb.
 * Messages still persist if Reverb is down.
 */
class RealtimeService
{
    /**
     * @param  array{conversationId: string, message: array<string, mixed>}  $payload
     */
    public function emitNewMessage(array $payload): void
    {
        $this->send('message.new', $payload, $this->channelsForConversation((string) ($payload['conversationId'] ?? '')));
    }

    /**
     * @param  array{conversationId: string, lastMessageAt: string, lastMessagePreview: string, lastSenderName: string}  $payload
     */
    public function emitConversationUpdate(array $payload): void
    {
        $this->send('conversation.update', $payload, $this->channelsForConversation((string) ($payload['conversationId'] ?? '')));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function emitPoke(string $targetUserId, array $payload): void
    {
        $this->send('poke', $payload, RealtimeBroadcast::forUsers([$targetUserId]));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function emitMention(string $targetUserId, array $payload): void
    {
        $this->send('mention', $payload, RealtimeBroadcast::forUsers([$targetUserId]));
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
        $channels = [
            ...RealtimeBroadcast::forUsers($userIds),
            ...RealtimeBroadcast::forRoles($roles),
        ];
        $this->send('notification', $payload, $channels);
    }

    public function refreshUserConversationRooms(string $userId): void
    {
        // Reverb delivers to the user's private channel at send time, so rooms
        // do not need to be rejoined when a conversation membership changes.
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<PrivateChannel>  $channels
     */
    private function send(string $event, array $payload, array $channels): void
    {
        if ($channels === []) {
            return;
        }

        try {
            broadcast(new RealtimeBroadcast($event, $payload, $channels));
        } catch (\Throwable $e) {
            Log::debug('Realtime notify failed: '.$e->getMessage());
        }
    }

    /**
     * @return list<PrivateChannel>
     */
    private function channelsForConversation(string $conversationId): array
    {
        if ($conversationId === '') {
            return [];
        }

        $conversation = Conversation::query()->find($conversationId);
        if (! $conversation) {
            return [];
        }

        if ($conversation->is_global) {
            return [new PrivateChannel('inbox')];
        }

        return RealtimeBroadcast::forUsers($conversation->participantIds());
    }
}
