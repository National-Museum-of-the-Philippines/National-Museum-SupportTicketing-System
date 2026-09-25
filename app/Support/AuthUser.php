<?php

namespace App\Support;

final class AuthUser
{
    public function __construct(
        public readonly string $id,
        public readonly string $email,
        public readonly string $name,
        public readonly string $role,
        public readonly string $division,
        public readonly string $designation = '',
    ) {}

    /**
     * @return array{id: string, email: string, name: string, role: string, division: string, designation: string}
     */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'role' => $this->role,
            'division' => $this->division,
            'designation' => $this->designation,
        ];
    }
}
