export const NOTIFICATION_DEFAULTS = Object.freeze({
  newStudent: true,
  newTicket: true,
  courseUpdates: true,
  systemAlerts: true,
});

export function normalizeNotificationPreferences(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.keys(NOTIFICATION_DEFAULTS).map(key => [key, typeof source[key] === 'boolean' ? source[key] : NOTIFICATION_DEFAULTS[key]]));
}

export function createNotificationService({ db, sendEmail, logger = console }) {
  async function preferencesFor(userId) {
    const row = await db.prepare('SELECT preferences_json FROM user_settings WHERE user_id=?').get(userId);
    let parsed = {};
    try { parsed = JSON.parse(row?.preferences_json || '{}'); } catch {}
    return normalizeNotificationPreferences(parsed);
  }

  async function notifyUser(userId, preference, subject, body, idempotencyKey) {
    const user = await db.prepare('SELECT id,name,email FROM users WHERE id=? AND active=1').get(userId);
    if (!user || !(await preferencesFor(user.id))[preference]) return { sent: false, reason: 'disabled' };
    try {
      await sendEmail(user.email, subject, `Olá, ${user.name}.\n\n${body}\n\nProjeto Aprendiz`, idempotencyKey);
      return { sent: true };
    } catch (error) {
      logger.error('preference_notification_failed', error, { userId: user.id, preference });
      return { sent: false, reason: 'delivery_failed' };
    }
  }

  async function notifyManagers(preference, subject, body, idempotencyKey) {
    const managers = await db.prepare("SELECT id FROM users WHERE role='gestor' AND active=1 ORDER BY id").all();
    return Promise.all(managers.map(user => notifyUser(user.id, preference, subject, body, `${idempotencyKey}/manager-${user.id}`)));
  }

  async function notifyProfessor(professorId, preference, subject, body, idempotencyKey) {
    const professor = await db.prepare('SELECT user_id FROM professor_profiles WHERE id=? AND active=1').get(professorId);
    if (!professor?.user_id) return { sent: false, reason: 'no_account' };
    return notifyUser(professor.user_id, preference, subject, body, `${idempotencyKey}/professor-${professorId}`);
  }

  return { preferencesFor, notifyUser, notifyManagers, notifyProfessor };
}
