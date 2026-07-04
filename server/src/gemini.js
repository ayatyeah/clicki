// Economical Gemini wrapper: rotates across up to 3 API keys (spreads quota /
// rate limits), small output cap. Caching lives at the call site (DB) so we only
// hit the API when data actually changed or the user forces a refresh.
const KEYS = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3].filter(Boolean);
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let keyIndex = 0;

export const geminiEnabled = KEYS.length > 0;

/** Generate text from a prompt, rotating keys on quota/rate errors.
 *  Pass json: true to get back a raw JSON string (caller parses it) — used
 *  for structured, multi-item output where a line-based format would be
 *  fragile (e.g. several brief drafts at once). */
export async function geminiGenerate(prompt, { maxTokens = 700, temperature = 0.4, json = false } = {}) {
  if (!geminiEnabled) throw new Error('Gemini keys not configured');
  let lastErr;
  // Try each key once (round-robin start), rotating on 429/403.
  for (let attempt = 0; attempt < KEYS.length; attempt += 1) {
    const key = KEYS[keyIndex % KEYS.length];
    keyIndex += 1;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            // thinkingBudget: 0 — gemini-2.5-flash otherwise spends most of
            // maxOutputTokens on invisible "thinking" tokens, truncating the
            // actual reply before it says anything useful.
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
              thinkingConfig: { thinkingBudget: 0 },
              ...(json ? { responseMimeType: 'application/json' } : {}),
            },
          }),
          // Don't let a slow/hung Gemini response hang the request that called this
          // (e.g. the public /api/assistant endpoint) — every caller here has a fallback.
          signal: AbortSignal.timeout(15000),
        }
      );
      if (res.status === 429 || res.status === 403) {
        lastErr = new Error(`Gemini quota/rate (${res.status}) on key #${(keyIndex % KEYS.length) + 1}`);
        continue; // rotate to next key
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
      if (!text) throw new Error('Gemini returned empty response');
      return text;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Gemini request failed');
}
