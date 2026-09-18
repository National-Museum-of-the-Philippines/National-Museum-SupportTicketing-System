<?php

namespace App\Utils;

final class FormFields
{
    /**
     * @param  array<int, array<string, mixed>>|null  $fields
     * @return array<int, array<string, mixed>>
     */
    public static function normalize(?array $fields): array
    {
        if (! is_array($fields)) {
            return [];
        }

        return array_map(function (array $field) {
            $type = $field['type'] ?? null;
            if (in_array($type, ['checkbox', 'radio', 'dropdown'], true)) {
                $options = $field['options'] ?? null;
                if (is_array($options) && count($options) === 1 && is_string($options[0]) && str_contains($options[0], ',')) {
                    $field['options'] = array_values(array_filter(array_map('trim', explode(',', $options[0]))));
                }
            }

            return $field;
        }, $fields);
    }
}
