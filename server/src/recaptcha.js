/**
 * Verify a reCAPTCHA v3 token.
 *
 * Returns a verdict the caller can act on WITHOUT guessing:
 *   { verified:false, reason }   — we never got a usable grade from Google:
 *                                  no secret, no token, expired/reused token,
 *                                  bad config, network failure.
 *   { verified:true, score }     — Google graded it. score 0.0 (certainly a
 *                                  bot) … 1.0 (certainly human).
 *
 * Deliberately no ok/!ok: what score counts as "too low" is the caller's policy,
 * and conflating "Google says bot" with "we couldn't ask Google" is exactly what
 * used to turn real sign-ups away.
 */
export async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) return { verified: false, reason: 'no-secret' };
  if (!token) return { verified: false, reason: 'no-token' };

  let data;
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: String(token) }),
      // Don't let a hung Google request tie up the form handler.
      signal: AbortSignal.timeout(5000),
    });
    data = await res.json();
  } catch (err) {
    return { verified: false, reason: `fetch-failed: ${err.message}` };
  }

  if (!data?.success) {
    // invalid-input-response (stale/forged token), timeout-or-duplicate (token
    // reused or older than 2 minutes), invalid-input-secret (our own config).
    // None of these prove the visitor is a bot.
    return { verified: false, reason: (data?.['error-codes'] || ['unknown']).join(',') };
  }
  return { verified: true, score: typeof data.score === 'number' ? data.score : null };
}
