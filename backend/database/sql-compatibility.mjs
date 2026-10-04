// Pure compatibility rules shared by Node and Cloudflare. Keep runtime-specific
// connections, migrations and SQLite imports in their respective adapters.
export function normalizeRow(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
}

export function postgresSql(source) {
  let sql = String(source).trim().replace(/;$/, '');
  const ignoredInsert = /^INSERT\s+OR\s+IGNORE\s+/i.test(sql);
  sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+/i, 'INSERT ');
  sql = sql.replace(/\bLIKE\b/g, 'ILIKE');
  sql = sql.replace(/GROUP_CONCAT\(DISTINCT\s+([^)]+)\)/gi, "STRING_AGG(DISTINCT $1, ',')");
  sql = sql.replace(/GROUP_CONCAT\(([^,)]+),\s*'([^']*)'\)/gi, "STRING_AGG($1, '$2')");
  if (ignoredInsert && !/\bON\s+CONFLICT\b/i.test(sql)) sql += ' ON CONFLICT DO NOTHING';
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export const tablesWithId = new Set([
  'users', 'sessions', 'password_resets', 'dev_emails', 'audit_log', 'locations',
  'professor_profiles', 'professor_invites', 'students', 'courses', 'classes',
  'school_years', 'churches', 'enrollments', 'attendance_sessions', 'attendance_records',
  'announcements', 'announcement_attachments', 'support_tickets', 'support_messages', 'support_attachments',
  'support_ticket_events', 'dropout_events', 'student_contacts', 'scheduled_notifications', 'profile_photos', 'push_subscriptions', 'notification_outbox',
  'manager_login_challenges', 'manager_login_devices',
]);
export const applicationTables = new Set([
  'class_presentation', 'course_post_likes', 'course_post_comments',
  'student_accounts', 'student_invites', 'student_announcement_audiences', 'student_announcement_classes',
  'student_notice_deliveries',
  'student_email_changes', 'notification_outbox',
  'student_course_announcements',
  ...tablesWithId, 'user_settings', 'announcement_reads', 'announcement_recipients',
  'support_ticket_reads', 'support_message_hides', 'support_conversation_hides', 'class_schedules', 'class_schedule_dates', 'enrollment_repair_archive', 'schema_migrations',
]);

export function returningId(sql) {
  const match = sql.match(/^\s*INSERT\s+INTO\s+(?:projeto_aprendiz\.)?([a-z_]+)/i);
  if (!match || !tablesWithId.has(match[1].toLowerCase()) || /\bRETURNING\b/i.test(sql)) return sql;
  return `${sql} RETURNING id`;
}

// Hyperdrive resets session state after each implicit transaction. Qualifying
// application tables avoids both an unsafe persistent search_path assumption
// and extra BEGIN/SET/COMMIT round trips for every ordinary query. Quoted text,
// comments, explicit schemas and aliases are preserved.
export function qualifyApplicationTables(sql) {
  const tokens = String(sql).match(/'(?:''|[^'])*'|"(?:""|[^"])*"|\$([a-zA-Z_][\w]*|)\$[\s\S]*?\$\1\$|--[^\r\n]*|\/\*[\s\S]*?\*\/|\s+|[a-zA-Z_][\w$]*|./g) || [];
  const significant = tokens.map((token, index) => ({ token, index })).filter(({ token }) => !/^\s|^--|^\/\*/.test(token));
  for (let position = 1; position < significant.length; position++) {
    const previous = significant[position - 1].token.toUpperCase();
    if (!['FROM', 'JOIN', 'UPDATE', 'INTO', 'USING'].includes(previous)) continue;
    const { token, index } = significant[position];
    const name = token.startsWith('"') ? token.slice(1, -1).replace(/""/g, '"') : token.toLowerCase();
    if (applicationTables.has(name) && significant[position + 1]?.token !== '.') tokens[index] = `projeto_aprendiz.${token}`;
  }
  return tokens.join('');
}

export function parseInt8(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : value;
}
