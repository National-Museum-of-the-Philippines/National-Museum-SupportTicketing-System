<?php

namespace App\Models;

use App\Support\Id;
use App\Traits\ApiSerializable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    use ApiSerializable {
        toApiArray as protected serializeApiAttributes;
    }

    protected $table = 'conversations';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'type',
        'direct_key',
        'ticket_id',
        'is_closed',
        'closed_at',
        'title',
        'is_global',
        'last_message_at',
        'last_message_preview',
        'last_sender_name',
    ];

    protected $casts = [
        'is_closed' => 'boolean',
        'is_global' => 'boolean',
        'closed_at' => 'datetime',
        'last_message_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (Conversation $conversation) {
            if (! $conversation->id) {
                $conversation->id = Id::newId();
            }
        });
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'conversation_participants', 'conversation_id', 'user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ConversationMessage::class, 'conversation_id');
    }

    /**
     * @return list<string>
     */
    public function participantIds(): array
    {
        if ($this->relationLoaded('participants')) {
            return $this->participants->map(fn (User $u) => (string) $u->id)->all();
        }

        return $this->participants()->allRelatedIds()->map(fn ($id) => (string) $id)->values()->all();
    }

    /**
     * @param  list<string>  $userIds
     */
    public function syncParticipants(array $userIds): void
    {
        $unique = array_values(array_unique(array_filter($userIds)));
        $this->participants()->sync($unique);
    }

    public function toApiArray(array $extra = [], array $hidden = []): array
    {
        return $this->serializeApiAttributes(array_merge([
            'participantIds' => $this->participantIds(),
        ], $extra), $hidden);
    }
}
