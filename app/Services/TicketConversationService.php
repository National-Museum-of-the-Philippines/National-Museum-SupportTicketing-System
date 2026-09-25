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

class TicketConversationService
{
    public function __construct(private RealtimeService $realtime) {}

    public function ensureTicketConversation(string $ticketId): Conversation
    {
        $conv = Conversation::query()->where('ticket_id', $ticketId)->first();
        if ($conv) {
            return $conv;
        }

        $ticket = Ticket::query()->with('assignees')->find($ticketId);
        if (! $ticket) {
            throw new ApiException(404, 'Ticket not found');
        }

        $participantIds = $this->buildTicketParticipantIds($ticket);
        $conv = Conversation::create([
            'type' => 'ticket',
            'ticket_id' => $ticket->id,
            'title' => $ticket->ticket_number,
            'is_global' => false,
            'is_closed' => false,
            'last_message_preview' => '',
            'last_sender_name' => '',
        ]);
        $conv->syncParticipants($participantIds);

        return $conv->fresh(['participants']);
    }

    public function syncTicketConversationParticipants(string $ticketId): ?Conversation
    {
        $ticket = Ticket::query()->with('assignees')->find($ticketId);
        if (! $ticket) {
            return null;
        }

        $conv = $this->ensureTicketConversation($ticketId);
        $nextParticipants = $this->buildTicketParticipantIds($ticket);
        $previous = $conv->participantIds();
        $previousSet = array_flip($previous);
        $added = array_values(array_filter($nextParticipants, fn ($id) => ! isset($previousSet[$id])));

        $conv->syncParticipants($nextParticipants);
        $conv->title = $ticket->ticket_number;
        $conv->save();

        foreach (array_unique([...$added, ...$nextParticipants]) as $userId) {
            $this->realtime->refreshUserConversationRooms($userId);
        }

        if ($added !== []) {
            $assignedIdSet = array_flip($ticket->assigneeIds());
            $addedAssigneeIds = array_values(array_filter($added, fn ($id) => isset($assignedIdSet[$id])));
            if ($addedAssigneeIds !== []) {
                $addedUsers = User::query()->whereIn('id', $addedAssigneeIds)->where('active', true)->get();
                if ($addedUsers->isNotEmpty()) {
                    $this->postTicketThreadSystemMessage(
                        (string) $conv->id,
                        'Assigned personnel added to this request thread: '.$addedUsers->pluck('name')->implode(', '),
                    );
                }
            }
        }

        return $conv->fresh(['participants']);
    }

    public function setTicketConversationClosedState(string $ticketId, bool $closed): ?Conversation
    {
        $conv = Conversation::query()->where('ticket_id', $ticketId)->first();
        if (! $conv) {
            return null;
        }

        $conv->is_closed = $closed;
        $conv->closed_at = $closed ? now() : null;
        $conv->save();

        if ($closed) {
            $this->postTicketThreadSystemMessage(
                (string) $conv->id,
                'This request conversation was closed because the client closed the request.',
            );
        }

        $participantIds = $conv->participantIds();
        $mentionableIds = $this->getTicketThreadMentionableUserIds($ticketId);
        foreach (array_unique([...$participantIds, ...$mentionableIds]) as $userId) {
            $this->realtime->refreshUserConversationRooms($userId);
        }

        return $conv;
    }

    /**
     * @return list<string>
     */
    public function getTicketThreadMentionableUserIds(string $ticketId): array
    {
        $ticket = Ticket::query()->with('assignees')->find($ticketId);
        if (! $ticket) {
            return [];
        }

        return $this->buildTicketParticipantIds($ticket);
    }

    public function canAccessTicketConversation(AuthUser $user, string $ticketId): bool
    {
        $ticket = Ticket::query()->with('assignees')->find($ticketId);
        if (! $ticket) {
            return false;
        }

        if ($user->role === 'record_management') {
            return false;
        }

        if ((string) $ticket->creator_id === $user->id) {
            return true;
        }

        if (in_array($user->id, $ticket->assigneeIds(), true)) {
            return true;
        }

        if ($user->role === 'admin') {
            return $this->getFormCreatorId($ticket) === $user->id;
        }

        return false;
    }

    /**
     * @return list<string>
     */
    private function buildTicketParticipantIds(Ticket $ticket): array
    {
        $ids = [(string) $ticket->creator_id, ...$ticket->assigneeIds()];
        $formCreatorId = $this->getFormCreatorId($ticket);
        if ($formCreatorId) {
            $ids[] = $formCreatorId;
        }

        return array_values(array_unique(array_filter($ids)));
    }

    private function getFormCreatorId(Ticket $ticket): ?string
    {
        $formId = Id::of($ticket->form_id);
        if ($formId === '') {
            return null;
        }
        $form = Form::query()->find($formId);

        return $form?->created_by ? (string) $form->created_by : null;
    }

    private function postTicketThreadSystemMessage(string $conversationId, string $body): void
    {
        $message = ConversationMessage::create([
            'conversation_id' => $conversationId,
            'sender_id' => Id::SYSTEM_USER_ID,
            'sender_name' => 'System',
            'sender_role' => 'admin',
            'body' => $body,
            'is_system' => true,
            'mentions' => [],
        ]);

        $preview = strlen($body) > 120 ? substr($body, 0, 117).'…' : $body;
        Conversation::query()->where('id', $conversationId)->update([
            'last_message_at' => $message->created_at,
            'last_message_preview' => $preview,
            'last_sender_name' => 'System',
        ]);

        $serialized = $message->toSerializedMessage();
        $this->realtime->emitNewMessage([
            'conversationId' => $conversationId,
            'message' => $serialized,
        ]);
        $this->realtime->emitConversationUpdate([
            'conversationId' => $conversationId,
            'lastMessageAt' => $serialized['createdAt'],
            'lastMessagePreview' => $preview,
            'lastSenderName' => 'System',
        ]);
    }
}
