<?php

namespace Tests\Unit;

use App\Services\TotpService;
use PHPUnit\Framework\TestCase;

class TotpServiceTest extends TestCase
{
    /** Base32 of the RFC 6238 SHA-1 test key "12345678901234567890". */
    private const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    public function test_codes_match_rfc_6238_reference_values(): void
    {
        $totp = new TotpService;

        $this->assertSame('287082', $totp->codeAt(self::RFC_SECRET, 59));
        $this->assertSame('081804', $totp->codeAt(self::RFC_SECRET, 1111111109));
        $this->assertSame('005924', $totp->codeAt(self::RFC_SECRET, 1234567890));
    }

    public function test_code_is_accepted_within_one_step_of_drift_only(): void
    {
        $totp = new TotpService;
        $now = 1234567890;
        $code = $totp->codeAt(self::RFC_SECRET, $now);

        $this->assertSame(intdiv($now, 30), $totp->matchingStep(self::RFC_SECRET, $code, $now));
        $this->assertNotNull($totp->matchingStep(self::RFC_SECRET, $code, $now + 30));
        $this->assertNull($totp->matchingStep(self::RFC_SECRET, $code, $now + 90));
        $this->assertNull($totp->matchingStep(self::RFC_SECRET, 'abcdef', $now));
        $this->assertNull($totp->matchingStep('', $code, $now));
    }

    public function test_generated_secret_round_trips(): void
    {
        $totp = new TotpService;
        $secret = $totp->generateSecret();

        $this->assertMatchesRegularExpression('/^[A-Z2-7]{32}$/', $secret);
        $this->assertNotNull($totp->matchingStep($secret, $totp->codeAt($secret, 1700000000), 1700000000));
    }
}
