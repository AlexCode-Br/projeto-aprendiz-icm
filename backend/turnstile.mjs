const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken({ token, ip, secretKey, allowedHostnames, expectedAction, fetchImpl = fetch }) {
  const responseToken = String(token || '').trim();
  const secret = String(secretKey || '').trim();
  if (!secret || !responseToken || responseToken.length > 2048) return false;
  const response = await fetchImpl(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: responseToken, remoteip: ip }),
  });
  if (!response.ok) return false;
  const result = await response.json();
  const hostname = String(result.hostname || '').toLowerCase();
  const action = String(result.action || '');
  const allowed = new Set((allowedHostnames || []).map(item => String(item).toLowerCase()));
  const challengeTime = Date.parse(result.challenge_ts || '');
  const freshChallenge = Number.isFinite(challengeTime) && challengeTime <= Date.now() + 60_000 && Date.now() - challengeTime <= 10 * 60_000;
  return result.success === true
    && (!allowed.size || allowed.has(hostname))
    && freshChallenge
    && (!expectedAction || action === expectedAction);
}
