<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RealtimeBroadcast implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    /**
     * @param  list<Channel>  $channels
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public string $event,
        public array $payload,
        public array $channels,
    ) {}

    /**
     * @return list<Channel>
     */
    public function broadcastOn(): array
    {
        return $this->channels;
    }

    public function broadcastAs(): string
    {
        return $this->event;
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return $this->payload;
    }

    /**
     * @param  list<string>  $userIds
     * @return list<PrivateChannel>
     */
    public static function forUsers(array $userIds): array
    {
        $channels = [];
        foreach (array_unique(array_filter($userIds)) as $id) {
            $channels[] = new PrivateChannel('user.'.$id);
        }

        return $channels;
    }

    /**
     * @param  list<string>  $roles
     * @return list<PrivateChannel>
     */
    public static function forRoles(array $roles): array
    {
        $channels = [];
        foreach (array_unique(array_filter($roles)) as $role) {
            $channels[] = new PrivateChannel('role.'.$role);
        }

        return $channels;
    }
}
