<?php

namespace App\Models;

use App\Support\Id;
use App\Traits\ApiSerializable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Poke extends Model
{
    use ApiSerializable;

    protected $table = 'pokes';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'from_user_id',
        'to_user_id',
        'conversation_id',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (Poke $poke) {
            if (! $poke->id) {
                $poke->id = Id::newId();
            }
        });
    }

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }
}
