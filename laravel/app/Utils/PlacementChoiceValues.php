<?php

namespace App\Utils;

final class PlacementChoiceValues
{
    public const PLACEMENT_CHECKMARK = '✓';

    public static function isChoiceFieldType(string $type): bool
    {
        return $type === 'checkbox' || $type === 'radio';
    }

    public static function isOthersOptionLabel(string $label): bool
    {
        return (bool) preg_match('/^others?$/i', trim($label));
    }

    public static function isOthersBlankPlacementLabel(string $placementLabel): bool
    {
        return (bool) preg_match('/^others?\s*\(\s*blank\s*\)$/i', trim($placementLabel));
    }

    /**
     * @param  array{type: string, label: string, options?: array<int, string>}  $field
     */
    public static function resolvePlacementOption(array $field, string $placementLabel): ?string
    {
        if (! self::isChoiceFieldType($field['type'])) {
            return null;
        }

        $options = $field['options'] ?? [];
        if ($options === []) {
            return null;
        }

        $label = trim($placementLabel);
        if ($label === '') {
            return null;
        }

        if (self::isOthersBlankPlacementLabel($label)) {
            return null;
        }

        foreach ($options as $option) {
            if ($option === $label) {
                return $option;
            }
        }

        foreach ($options as $option) {
            if (self::normalizeOption($option) === self::normalizeOption($label)) {
                return $option;
            }
        }

        if (self::normalizeOption($label) === self::normalizeOption($field['label'])) {
            return null;
        }

        return null;
    }

    public static function isChoiceOptionSelected(mixed $value, string $option): bool
    {
        $target = self::normalizeOption($option);
        $isOthersOption = (bool) preg_match('/^others?$/', $target);

        if (is_array($value)) {
            foreach ($value as $item) {
                $text = (string) $item;
                if (self::normalizeOption($text) === $target) {
                    return true;
                }
                if ($isOthersOption && (preg_match('/^others?\s*:/i', $text) || preg_match('/^others?$/i', $text))) {
                    return true;
                }
            }

            return false;
        }

        if ($value === true || $value === 'true') {
            return $target === 'yes';
        }

        if ($value === false || $value === 'false') {
            return false;
        }

        return self::normalizeOption((string) $value) === $target;
    }

    /**
     * @param  array{type: string, label: string, options?: array<int, string>}  $field
     */
    public static function displayValueForChoicePlacement(
        array $field,
        string $placementLabel,
        mixed $value,
        bool $showMarkerWhenEmpty = false,
    ): ?string {
        if (! self::isChoiceFieldType($field['type'])) {
            return null;
        }

        // Blank beside Others → typed word only.
        if (self::isOthersBlankPlacementLabel($placementLabel)) {
            $hasOthers = false;
            foreach ($field['options'] ?? [] as $option) {
                if (self::isOthersOptionLabel((string) $option)) {
                    $hasOthers = true;
                    break;
                }
            }
            if (! $hasOthers) {
                return '';
            }
            $detail = self::extractOthersDetail($value);
            if ($detail !== '') {
                return $detail;
            }

            return $showMarkerWhenEmpty ? '…' : '';
        }

        $option = self::resolvePlacementOption($field, $placementLabel);
        if ($option === null) {
            return null;
        }

        // Others checkbox → checkmark only; detail goes on the blank placement.
        if (self::isChoiceOptionSelected($value, $option)) {
            return self::PLACEMENT_CHECKMARK;
        }

        if ($showMarkerWhenEmpty) {
            return self::PLACEMENT_CHECKMARK;
        }

        return '';
    }

    public static function extractOthersDetail(mixed $value): string
    {
        if (is_array($value)) {
            foreach ($value as $item) {
                $text = (string) $item;
                if (preg_match('/^others?\s*:\s*(.+)$/i', $text, $match) && trim($match[1]) !== '') {
                    return trim($match[1]);
                }
            }

            return '';
        }

        if (is_string($value) && preg_match('/^others?\s*:\s*(.+)$/i', $value, $match) && trim($match[1]) !== '') {
            return trim($match[1]);
        }

        return '';
    }

    public static function isPlacementCheckmark(string $text): bool
    {
        return $text === self::PLACEMENT_CHECKMARK;
    }

    private static function normalizeOption(string $value): string
    {
        return strtolower(trim($value));
    }
}
