<?php

namespace App\Services;

/**
 * Time-based one-time passwords (RFC 6238, HMAC-SHA1, 6 digits, 30-second steps)
 * as used by Google Authenticator and compatible apps.
 */
class TotpService
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    private const PERIOD = 30;

    private const DIGITS = 6;

    /** New base32 secret (160 bits). */
    public function generateSecret(): string
    {
        return $this->base32Encode(random_bytes(20));
    }

    /**
     * Time step the code is valid for (allowing one step of clock drift either way),
     * or null when the code does not match.
     */
    public function matchingStep(string $secret, string $code, ?int $timestamp = null): ?int
    {
        $code = preg_replace('/\s+/', '', $code) ?? '';
        if (! preg_match('/^\d{'.self::DIGITS.'}$/', $code)) {
            return null;
        }

        $key = $this->base32Decode($secret);
        if ($key === '') {
            return null;
        }

        $current = intdiv($timestamp ?? time(), self::PERIOD);
        foreach ([0, -1, 1] as $offset) {
            if (hash_equals($this->codeForStep($key, $current + $offset), $code)) {
                return $current + $offset;
            }
        }

        return null;
    }

    public function codeAt(string $secret, int $timestamp): string
    {
        return $this->codeForStep($this->base32Decode($secret), intdiv($timestamp, self::PERIOD));
    }

    /** otpauth:// URI an authenticator app can import. */
    public function provisioningUri(string $secret, string $account, string $issuer): string
    {
        return 'otpauth://totp/'.rawurlencode($issuer.':'.$account)
            .'?secret='.$secret
            .'&issuer='.rawurlencode($issuer)
            .'&algorithm=SHA1&digits='.self::DIGITS.'&period='.self::PERIOD;
    }

    private function codeForStep(string $key, int $step): string
    {
        $hash = hash_hmac('sha1', pack('J', $step), $key, true);
        $offset = ord($hash[19]) & 0x0F;
        $value = unpack('N', substr($hash, $offset, 4))[1] & 0x7FFFFFFF;

        return str_pad((string) ($value % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    private function base32Encode(string $bytes): string
    {
        $bits = '';
        foreach (str_split($bytes) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $out = '';
        foreach (str_split($bits, 5) as $chunk) {
            $out .= self::ALPHABET[bindec(str_pad($chunk, 5, '0'))];
        }

        return $out;
    }

    private function base32Decode(string $secret): string
    {
        $secret = strtoupper(rtrim(preg_replace('/\s+/', '', $secret) ?? '', '='));
        if ($secret === '' || strspn($secret, self::ALPHABET) !== strlen($secret)) {
            return '';
        }

        $bits = '';
        foreach (str_split($secret) as $char) {
            $bits .= str_pad(decbin(strpos(self::ALPHABET, $char)), 5, '0', STR_PAD_LEFT);
        }

        $out = '';
        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) {
                $out .= chr(bindec($chunk));
            }
        }

        return $out;
    }
}
