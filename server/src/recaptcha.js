/**
 * Verify a reCAPTCHA v3 token. If no secret is configured, verification is
 * skipped (returns ok) so local/dev environments work without keys.
 */
export async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, reason: 'missing-token' };

  const params = new URLSearchParams({ secret, response: token });
  // Don't let a hung Google request tie up the lead-submit handler.
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json().catch(() => ({}));
  const min = Number(process.env.RECAPTCHA_MIN_SCORE) || 0.5;

  if (!data.success || (typeof data.score === 'number' && data.score < min)) {
    return { ok: false, reason: 'low-score', score: data.score };
  }
  return { ok: true, score: data.score };
}
