<?php

namespace App\Utils;

final class PlacementValues
{
    /**
     * @param  array<int, array{variable?: string|null, type?: string|null}>  $fields
     * @param  array<string, mixed>  $answers
     * @return array<string, mixed>
     */
    public static function normalizeTicketAnswers(array $fields, array $answers): array
    {
        $normalized = [];

        foreach ($fields as $field) {
            $variable = trim((string) ($field['variable'] ?? ''));
            if ($variable === '') {
                continue;
            }
            $raw = self::resolveAnswerForVariable($answers, $variable);
            if ($raw === null) {
                $normalized[$variable] = (($field['type'] ?? '') === 'checkbox') ? [] : '';
            } else {
                $normalized[$variable] = $raw;
            }
        }

        foreach (ProfilePlacementFields::PROFILE_PLACEMENT_VARIABLES as $variable) {
            $raw = self::resolveAnswerForVariable($answers, $variable);
            if ($raw !== null && $raw !== '') {
                $normalized[$variable] = $raw;
            }
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $answers
     */
    public static function resolveAnswerForVariable(array $answers, string $variable): mixed
    {
        if (array_key_exists($variable, $answers)) {
            return $answers[$variable];
        }

        $inner = preg_replace('/^\{\{|\}\}$/', '', $variable) ?? $variable;
        if ($inner !== $variable && array_key_exists($inner, $answers)) {
            return $answers[$inner];
        }

        $wrapped = str_starts_with($variable, '{{') ? $variable : '{{'.$inner.'}}';
        if ($wrapped !== $variable && array_key_exists($wrapped, $answers)) {
            return $answers[$wrapped];
        }

        return null;
    }
}
