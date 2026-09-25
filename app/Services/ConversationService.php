<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Models\Form;
use App\Models\Ticket;
use App\Models\User;
use App\Support\ApiException;
use App\Support\AuthUser;
use App\Support\Id;

class ConversationService
{
    private const GLOBAL_TITLE = 'NMP Team Chat';

    public function __construct(
        private TicketConversationService $ticketConversations,
        private RealtimeService $realtime,
    ) {}

    public function ensureGlobalConversation(): Conversation
    {
        $conv = Conversation::query()->where('is_global', true)->first();
        if (! $conv) {
            $conv = Conversation::create([
                'type' => 'group',
                'title' => self::GLOBAL_TITLE,
                'is_global' => true,
                'is_closed' => false,
                'last_message_preview' => '',
                'last_sender_name' => '',
            ]);
            $conv->syncParticipants([]);
        }

        return $conv;
    }

    /**
     * @return list<array{id: string, name: string, email: string, role: string, division: string}>
     */
    public function listMessageableUsers(AuthUser $user): array
    {
        $q = User::query()->where('active', true)->where('id', '!=', $user->id);
        if ($user->role !== 'record_management') {
            $q->where('role', '!=', 'record_management');
        }

        return $q->orderBy('role')->orderBy('name')
            ->get()
            ->map(fn (User $u) => $this->serializeUser($u))
            ->all();
    }

    /**
     * @return list<array{id: string, name: string, email: string, role: string, division: string}>
     */
    public function listMentionableUsers(AuthUser $user, string $conversationId): array
    {
        $conversation = Conversation::query()->with('participants')->find($conversationId);
        if (! $conversation) {
            throw new ApiException(404, 'Conversation not found');
        }
        $this->assertConversationAccess($user, $conversation);

        $ids = array_values(array_filter(
            $this->getMentionableUserIds($conversation),
            fn ($id) => $id !== $user->id,
        ));

        return User::query()
            ->whereIn('id', $ids)
            ->where('active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => $this->serializeUser($u))
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listConversations(AuthUser $user): array
    {
        $this->ensureGlobalConversation();

        if ($user->role === 'user') {
            $myTickets = Ticket::query()
                ->where('creator_id', $user->id)
                ->where('status', '!=', 'rejected')
                ->get();
            foreach ($myTickets as $t) {
                $this->ticketConversations->syncTicketConversationParticipants((string) $t->id);
            }
        } elseif ($user->role === 'admin') {
            $formIds = Form::query()->where('created_by', $user->id)->pluck('id')->all();
            if ($formIds !== []) {
                $creatorTickets = Ticket::query()
                    ->whereIn('form_id', $formIds)
                    ->where('status', '!=', 'rejected')
                    ->get();
                foreach ($creatorTickets as $t) {
                    $this->ticketConversations->syncTicketConversationParticipants((string) $t->id);
                }
            }
        }

        $assignedTickets = Ticket::query()
            ->whereHas('assignees', fn ($q) => $q->where('users_.id', $user->id))
            ->where('status', '!=', 'rejected')
            ->get();
        foreach ($assignedTickets as $t) {
            $this->ticketConversations->syncTicketConversationParticipants((string) $t->id);
        }

        $conversations = Conversation::query()
            ->with('participants')
            ->where(function ($q) use ($user) {
                $q->where('is_global', true)
                    ->orWhereHas('participants', fn ($p) => $p->where('users_.id', $user->id));
            })
            ->orderByDesc('is_global')
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->get();

        $ticketIds = $conversations->filter(fn ($c) => $c->ticket_id)->pluck('ticket_id')->all();
        $tickets = $ticketIds !== []
            ? Ticket::query()->with('assignees')->whereIn('id', $ticketIds)->get()->keyBy('id')
            : collect();

        $visible = $conversations->filter(function (Conversation $conv) use ($user, $tickets) {
            if ($user->role === 'user') {
                if ($conv->is_closed) {
                    return false;
                }
                if (! $conv->ticket_id) {
                    return true;
                }
                $ticket = $tickets->get($conv->ticket_id);

                return $ticket && (string) $ticket->creator_id === $user->id;
            }
            if ($user->role === 'record_management') {
                return ! $conv->is_closed && ! $conv->ticket_id;
            }

            return ! $conv->is_closed;
        });

        $otherUserIds = [];
        foreach ($visible as $conv) {
            if ($conv->type === 'direct') {
                foreach ($conv->participantIds() as $id) {
                    if ($id !== $user->id) {
                        $otherUserIds[$id] = true;
                    }
                }
            }
        }

        $otherMap = User::query()->whereIn('id', array_keys($otherUserIds))->get()
            ->mapWithKeys(fn (User $u) => [(string) $u->id => $this->serializeUser($u)]);

        return $visible->map(function (Conversation $conv) use ($user, $tickets, $otherMap) {
            $base = [
                '_id' => (string) $conv->id,
                'type' => $conv->type,
                'title' => $conv->title,
                'isGlobal' => (bool) $conv->is_global,
                'lastMessageAt' => optional($conv->last_message_at)?->toISOString(),
                'lastMessagePreview' => $conv->last_message_preview ?? '',
                'lastSenderName' => $conv->last_sender_name ?? '',
                'ticketId' => $conv->ticket_id ? (string) $conv->ticket_id : null,
            ];

            if ($conv->is_global) {
                return [...$base, 'title' => self::GLOBAL_TITLE, 'subtitle' => 'Admin, Records & Clients'];
            }

            if ($conv->ticket_id) {
                $ticket = $tickets->get($conv->ticket_id);
                $assignees = $ticket?->assignees ?? collect();

                return [
                    ...$base,
                    'type' => 'ticket',
                    'title' => $ticket?->ticket_number ?? $conv->title,
                    'subtitle' => $ticket
                        ? 'Client: '.$ticket->creator_name.' · Assigned: '.($assignees->isNotEmpty() ? $assignees->pluck('name')->implode(', ') : 'Awaiting assignment')
                        : 'Request thread',
                    'threadParticipants' => 'Admin, client & assigned personnel',
                    'ticketStatus' => $ticket?->status,
                    'ticketTitle' => $ticket?->title ?? '',
                ];
            }

            if ($conv->type === 'direct') {
                $otherId = collect($conv->participantIds())->first(fn ($id) => $id !== $user->id);
                $other = $otherId ? $otherMap->get($otherId) : null;

                return [
                    ...$base,
                    'title' => $other['name'] ?? 'Direct chat',
                    'subtitle' => $other
                        ? (($other['role'] === 'admin' ? 'Admin' : ($other['role'] === 'record_management' ? 'Records' : 'Client')).' · '.$other['division'])
                        : '',
                    'otherUser' => $other,
                ];
            }

            return [...$base, 'subtitle' => count($conv->participantIds()).' members'];
        })->values()->all();
    }

    /**
     * @return array{conversation: array<string, mixed>}
     */
    public function getOrCreateDirectConversation(AuthUser $user, string $otherUserId): array
    {
        if ($otherUserId === $user->id) {
            throw new ApiException(400, 'Cannot start a chat with yourself');
        }

        $other = User::query()->where('id', $otherUserId)->where('active', true)->first();
        if (! $other) {
            throw new ApiException(404, 'User not found');
        }

        $key = $this->directKeyFor($user->id, $otherUserId);
        $conv = Conversation::query()->where('direct_key', $key)->first();
        if (! $conv) {
            $conv = Conversation::create([
                'type' => 'direct',
                'direct_key' => $key,
                'is_global' => false,
                'is_closed' => false,
                'title' => '',
                'last_message_preview' => '',
                'last_sender_name' => '',
            ]);
            $conv->syncParticipants([$user->id, $otherUserId]);
        }

        $otherUser = $this->serializeUser($other);

        return [
            'conversation' => [
                '_id' => (string) $conv->id,
                'type' => 'direct',
                'title' => $otherUser['name'],
                'subtitle' => ($otherUser['role'] === 'admin' ? 'Admin' : ($otherUser['role'] === 'record_management' ? 'Records' : 'Client')).' · '.$otherUser['division'],
                'isGlobal' => false,
                'ticketId' => null,
                'otherUser' => $otherUser,
            ],
        ];
    }

    /**
     * @return array{conversation: array<string, mixed>}
     */
    public function getTicketConversation(AuthUser $user, string $ticketId): array
    {
        $this->ticketConversations->syncTicketConversationParticipants($ticketId);
        $conv = Conversation::query()->with('participants')->where('ticket_id', $ticketId)->first();
        if (! $conv) {
            throw new ApiException(404, 'Conversation not found');
        }
        if ($conv->is_closed) {
            throw new ApiException(404, 'Conversation is closed');
        }
        $this->assertConversationAccess($user, $conv);

        $ticket = Ticket::query()->with('assignees')->find($ticketId);
        $assignees = $ticket?->assignees ?? collect();

        return [
            'conversation' => [
                '_id' => (string) $conv->id,
                'type' => 'ticket',
                'title' => $ticket?->ticket_number ?? $conv->title,
                'subtitle' => $ticket
                    ? 'Client: '.$ticket->creator_name.' · Assigned: '.($assignees->isNotEmpty() ? $assignees->pluck('name')->implode(', ') : 'Awaiting assignment')
                    : 'Request thread',
                'threadParticipants' => 'Admin, client & assigned personnel',
                'isGlobal' => false,
                'ticketId' => $ticketId,
                'ticketStatus' => $ticket?->status,
                'ticketTitle' => $ticket?->title ?? '',
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listConversationMessages(AuthUser $user, string $conversationId): array
    {
        $conversation = Conversation::query()->with('participants')->find($conversationId);
        if (! $conversation) {
            throw new ApiException(404, 'Conversation not found');
        }
        $this->assertConversationAccess($user, $conversation);

        return ConversationMessage::query()
            ->where('conversation_id', $conversationId)
            ->orderBy('created_at')
            ->get()
            ->map(fn (ConversationMessage $m) => $m->toSerializedMessage())
            ->all();
    }

    /**
     * @param  list<string>  $mentionIds
     * @return array<string, mixed>
     */
    public function postConversationMessage(AuthUser $user, string $conversationId, string $body, array $mentionIds = []): array
    {
        $trimmed = trim($body);
        if ($trimmed === '') {
            throw new ApiException(400, 'Message cannot be empty');
        }
        if (strlen($trimmed) > 4000) {
            throw new ApiException(400, 'Message is too long (max 4000 characters)');
        }

        $conversation = Conversation::query()->with('participants')->find($conversationId);
        if (! $conversation) {
            throw new ApiException(404, 'Conversation not found');
        }
        $this->assertConversationAccess($user, $conversation);
        if ($conversation->is_closed) {
            throw new ApiException(400, 'Conversation is already closed');
        }

        $mentionableIds = array_flip($this->getMentionableUserIds($conversation));
        $validMentionIds = array_values(array_unique(array_filter(
            $mentionIds,
            fn ($id) => $id !== $user->id && isset($mentionableIds[$id]),
        )));

        $mentionUsers = $validMentionIds !== []
            ? User::query()->whereIn('id', $validMentionIds)->get()
            : collect();

        $mentions = $mentionUsers->map(fn (User $u) => [
            'userId' => (string) $u->id,
            'userName' => $u->name,
        ])->all();

        $message = ConversationMessage::create([
            'conversation_id' => $conversationId,
            'sender_id' => $user->id,
            'sender_name' => $user->name,
            'sender_role' => $user->role,
            'body' => $trimmed,
            'mentions' => $mentions,
            'is_system' => false,
        ]);

        $preview = strlen($trimmed) > 120 ? substr($trimmed, 0, 117).'…' : $trimmed;
        $conversation->last_message_at = $message->created_at;
        $conversation->last_message_preview = $preview;
        $conversation->last_sender_name = $user->name;
        $conversation->save();

        $serialized = $message->toSerializedMessage();
        $this->realtime->emitNewMessage([
            'conversationId' => $conversationId,
            'message' => $serialized,
        ]);
        $this->realtime->emitConversationUpdate([
            'conversationId' => $conversationId,
            'lastMessageAt' => $serialized['createdAt'],
            'lastMessagePreview' => $preview,
            'lastSenderName' => $user->name,
        ]);

        foreach ($serialized['mentions'] as $mention) {
            $this->realtime->emitMention($mention['userId'], [
                '_id' => $serialized['_id'].':'.$mention['userId'],
                'conversationId' => $conversationId,
                'messageId' => $serialized['_id'],
                'fromUserId' => $user->id,
                'fromUserName' => $user->name,
                'fromUserRole' => $user->role,
                'toUserId' => $mention['userId'],
                'preview' => $preview,
                'createdAt' => $serialized['createdAt'],
            ]);
        }

        return $serialized;
    }

    private function assertConversationAccess(AuthUser $user, Conversation $conversation): void
    {
        if ($conversation->is_global) {
            return;
        }
        if ($conversation->is_closed) {
            throw new ApiException(404, 'Conversation is closed');
        }

        if ($conversation->ticket_id) {
            if ($this->ticketConversations->canAccessTicketConversation($user, (string) $conversation->ticket_id)) {
                return;
            }
            throw new ApiException(403, 'You do not have access to this conversation');
        }

        if (! in_array($user->id, $conversation->participantIds(), true)) {
            throw new ApiException(403, 'You do not have access to this conversation');
        }
    }

    /**
     * @return list<string>
     */
    private function getMentionableUserIds(Conversation $conversation): array
    {
        if ($conversation->is_closed) {
            return [];
        }
        if ($conversation->is_global) {
            return User::query()->where('active', true)->pluck('id')->map(fn ($id) => (string) $id)->all();
        }
        if ($conversation->ticket_id) {
            return $this->ticketConversations->getTicketThreadMentionableUserIds((string) $conversation->ticket_id);
        }

        return $conversation->participantIds();
    }

    private function directKeyFor(string $a, string $b): string
    {
        $ids = [$a, $b];
        sort($ids);

        return implode(':', $ids);
    }

    /**
     * @return array{id: string, name: string, email: string, role: string, division: string}
     */
    private function serializeUser(User $u): array
    {
        return [
            'id' => (string) $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->role,
            'division' => $u->division ?? '',
        ];
    }
}
