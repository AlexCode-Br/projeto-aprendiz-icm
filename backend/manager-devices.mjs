import { randomBytes } from 'node:crypto';
import { sha256 } from './security.mjs';
import { managerDeviceEmail } from './manager-login-email.mjs';
import { MANAGER_DEVICE_ALERT } from './notifications.mjs';

export const MANAGER_DEVICE_MAX_AGE = 365 * 86400;

// Called inside the session transaction: registration and alert queue commit together.
// This cookie recognizes a browser only; it never authenticates or bypasses MFA.
export async function registerManagerDevice({ db, notificationOutbox, user, request, ip, cookies, baseUrl, now }) {
  const presented = cookies(request).pa_device;
  const valid = typeof presented === 'string' && /^[A-Za-z0-9_-]{43}$/.test(presented);
  const known = valid ? await db.prepare(
    'SELECT id FROM manager_login_devices WHERE user_id=? AND token_hash=? AND expires_at>?',
  ).get(user.id, sha256(presented), now) : null;
  const expiresAt = new Date(Date.parse(now) + MANAGER_DEVICE_MAX_AGE * 1000).toISOString();
  if (known) {
    await db.prepare('UPDATE manager_login_devices SET last_seen_at=?,expires_at=? WHERE id=?')
      .run(now, expiresAt, known.id);
    return { token: presented, queued: 0 };
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);
  await db.prepare('INSERT INTO manager_login_devices(user_id,token_hash,last_seen_at,expires_at) VALUES (?,?,?,?)')
    .run(user.id, tokenHash, now, expiresAt);
  const { queued } = await notificationOutbox.enqueueMany([{
    userId: user.id, preference: MANAGER_DEVICE_ALERT,
    subject: 'Novo dispositivo conectado — Projeto Aprendiz',
    body: managerDeviceEmail({
      name: user.name, connectedAt: new Date(now), ip, request,
      securityUrl: new URL('/configuracoes', baseUrl).toString(),
    }),
    destination: '/configuracoes',
    idempotencyKey: `manager-device/${user.id}/${tokenHash}`,
    channels: { email: true, push: false },
  }], { schedule: false });
  return { token, queued };
}
