<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Details of a COS staff member. Updates (Settings, activate / deactivate) change this table. */
class CosStaff extends Model
{
    protected $table = 'cos_staffs';

    protected $fillable = ['user_id', 'email', 'name', 'designation', 'section_id', 'section_name', 'active', 'created_by'];

    protected $casts = ['active' => 'boolean'];

    public function account(): BelongsTo
    {
        return $this->belongsTo(CosUser::class, 'user_id');
    }
}
