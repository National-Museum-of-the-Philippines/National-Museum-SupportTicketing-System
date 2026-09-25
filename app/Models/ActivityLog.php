<?php

namespace App\Models;

use App\Support\Id;
use App\Traits\ApiSerializable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    use ApiSerializable;

    protected $table = 'activity_logs';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'actor_id',
        'actor_name',
        'action',
        'entity_type',
        'entity_id',
        'summary',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (ActivityLog $log) {
            if (! $log->id) {
                $log->id = Id::newId();
            }
            if ($log->meta === null) {
                $log->meta = [];
            }
        });
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
