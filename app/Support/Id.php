<?php

namespace App\Support;

final class Id
{
    public const SYSTEM_USER_ID = '000000000000000000000000';

    /** 24-char hex id (ObjectId-compatible string shape for API/_id). */
    public static function newId(): string
    {
        return bin2hex(random_bytes(12));
    }

    public static function of(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_string($value)) {
            return $value;
        }

        if (is_object($value)) {
            if (isset($value->_id)) {
                return self::of($value->_id);
            }
            if (isset($value->id)) {
                return self::of($value->id);
            }
            if (method_exists($value, '__toString')) {
                $s = (string) $value;
                if ($s !== '' && $s !== '[object Object]') {
                    return $s;
                }
            }
        }

        if (is_array($value)) {
            if (isset($value['_id'])) {
                return self::of($value['_id']);
            }
            if (isset($value['id'])) {
                return self::of($value['id']);
            }
        }

        return (string) $value;
    }
}
