<?php

namespace App\Services;

use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use UnexpectedValueException;

class JwtService
{
    public function sign(User $user): string
    {
        $now = time();
        $payload = [
            'sub' => (string) $user->id,
            'email' => $user->email,
            'role' => $user->role,
            'iat' => $now,
            'exp' => $now + (60 * 60 * 24 * 7),
        ];

        return JWT::encode($payload, $this->secret(), 'HS256');
    }

    /**
     * @return array{sub: string, email?: string, role?: string}
     */
    public function verify(string $token): array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->secret(), 'HS256'));

            return (array) $decoded;
        } catch (UnexpectedValueException|\Throwable $e) {
            throw $e;
        }
    }

    private function secret(): string
    {
        return (string) env('JWT_SECRET', 'change-me-in-production-nmp-ticketing');
    }
}
