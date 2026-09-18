<?php

namespace App\Models;

use App\Support\Id;
use App\Traits\ApiSerializable;
use App\Utils\FormFields;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Form extends Model
{
    use ApiSerializable {
        toApiArray as protected serializeApiAttributes;
    }

    protected $table = 'forms';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'title',
        'ref_number',
        'effectivity',
        'version',
        'fields',
        'signatories',
        'print_template',
        'print_template_image_path',
        'print_placements',
        'print_placement_font_size',
        'work_procedure_name',
        'work_procedure_path',
        'status',
        'description',
        'department',
        'require_recommending_officer',
        'require_immediate_supervisor',
        'action_officer_count',
        'action_officers',
        'review_remarks',
        'reviewed_by',
        'reviewed_at',
        'submitted_for_review_at',
        'duplicated_from',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'fields' => 'array',
        'signatories' => 'array',
        'print_placements' => 'array',
        'print_placement_font_size' => 'integer',
        'require_recommending_officer' => 'boolean',
        'require_immediate_supervisor' => 'boolean',
        'action_officer_count' => 'integer',
        'action_officers' => 'array',
        'reviewed_at' => 'datetime',
        'submitted_for_review_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (Form $form) {
            if (! $form->id) {
                $form->id = Id::newId();
            }
        });
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function toApiArray(array $extra = [], array $hidden = []): array
    {
        $fields = FormFields::normalize($this->fields ?? []);
        $createdBy = $this->relationLoaded('creator') && $this->creator
            ? [
                '_id' => (string) $this->creator->id,
                'name' => $this->creator->name,
                'email' => $this->creator->email,
                'division' => $this->creator->division ?? '',
            ]
            : (string) $this->created_by;

        return $this->serializeApiAttributes(array_merge([
            'fields' => $fields,
            'createdBy' => $createdBy,
        ], $extra), $hidden);
    }
}
