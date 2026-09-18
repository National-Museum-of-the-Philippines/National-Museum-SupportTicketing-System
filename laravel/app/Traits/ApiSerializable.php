<?php

namespace App\Traits;

trait ApiSerializable
{
    /**
     * Emit API-shaped array: `_id` + camelCase keys matching Express lean docs.
     *
     * @param  array<string, mixed>  $extra
     * @param  array<int, string>  $hidden
     * @return array<string, mixed>
     */
    public function toApiArray(array $extra = [], array $hidden = []): array
    {
        $attrs = $this->attributesToArray();
        unset($attrs['password_hash']);

        foreach ($hidden as $key) {
            unset($attrs[$key]);
        }

        $out = [];
        foreach ($attrs as $key => $value) {
            if ($key === 'id') {
                $out['_id'] = (string) $value;
                continue;
            }
            $out[$this->snakeToCamel((string) $key)] = $this->apiCastValue($key, $value);
        }

        return array_merge($out, $extra);
    }

    protected function snakeToCamel(string $key): string
    {
        return lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $key))));
    }

    protected function apiCastValue(string $key, mixed $value): mixed
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('c');
        }

        if (is_bool($value) || is_int($value) || is_float($value) || is_array($value) || is_null($value)) {
            return $value;
        }

        return $value;
    }
}
