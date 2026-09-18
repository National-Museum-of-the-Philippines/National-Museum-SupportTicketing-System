<?php

namespace App\Models;

use App\Support\Id;
use App\Traits\ApiSerializable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversationMessage extends Model
{
    use ApiSerializable;

    protected $table = 'conversation_messages';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'conversation_id',
        'sender_id',
        'sender_name',
        'sender_role',
        'body',
        'mentions',
        'is_system',
    ];

    protected $casts = [
        'mentions' => 'array',
        'is_system' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (ConversationMessage $message) {
            if (! $message->id) {
                $message->id = Id::newId();
            }
            if ($message->mentions === null) {
                $message->mentions = [];
            }
        });
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'conversation_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toSerializedMessage(): array
    {
        $mentions = collect($this->mentions ?? [])->map(function ($m) {
            if (is_array($m)) {
                return [
                    'userId' => (string) ($m['userId'] ?? $m['user_id'] ?? ''),
                    'userName' => (string) ($m['userName'] ?? $m['user_name'] ?? ''),
                ];
            }

            return ['userId' => '', 'userName' => ''];
        })->values()->all();

        return [
            '_id' => (string) $this->id,
            'conversationId' => (string) $this->conversation_id,
            'senderId' => (string) $this->sender_id,
            'senderName' => $this->sender_name,
            'senderRole' => $this->sender_role,
            'body' => $this->body,
            'mentions' => $mentions,
            'isSystem' => (bool) $this->is_system,
            'createdAt' => optional($this->created_at)?->toISOString() ?? now()->toISOString(),
        ];
    }
}
