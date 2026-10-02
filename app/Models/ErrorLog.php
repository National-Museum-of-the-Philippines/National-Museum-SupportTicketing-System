<?php

namespace App\Models;

use App\Support\Id;
use App\Traits\ApiSerializable;
use Illuminate\Database\Eloquent\Model;

/**
 * One distinct application error (server, client, or console), with an
 * occurrence counter so repeats do not flood the Error Monitoring page.
 */
class ErrorLog extends Model
{
    use ApiSerializable;

    protected $table = 'error_logs';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'source',
        'level',
        'status',
        'message',
        'exception',
        'file',
        'line',
        'trace',
        'method',
        'url',
        'user_id',
        'user_name',
        'user_role',
        'ip',
        'user_agent',
        'fingerprint',
        'occurrences',
        'first_seen_at',
        'last_seen_at',
        'resolved_at',
        'resolved_by',
    ];

    protected $casts = [
        'status' => 'integer',
        'line' => 'integer',
        'occurrences' => 'integer',
        'first_seen_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'resolved_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (ErrorLog $log) {
            if (! $log->id) {
                $log->id = Id::newId();
            }
        });
    }
}
