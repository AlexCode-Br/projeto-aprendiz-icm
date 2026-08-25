import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..');
const distRoot = join(projectRoot, 'dist');
const dataRoot = join(here, 'data');
const port = Number(process.env.PORT || 4180);
const baseUrl = process.env.APP_URL || `http://127.0.0.1:${port}`;
const isProduction = process.env.NODE_ENV === 'production';

await mkdir(dataRoot, { recursive: true });
const db = new DatabaseSync(join(dataRoot, 'projeto-aprendiz.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('gestor','professor')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS dev_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    ip TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS professor_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT,
    home_location_id INTEGER REFERENCES locations(id),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS professor_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    professor_profile_id INTEGER NOT NULL REFERENCES professor_profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL COLLATE NOCASE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT,
    church TEXT,
    age_group TEXT,
    has_instrument INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL REFERENCES courses(id),
    professor_id INTEGER NOT NULL REFERENCES professor_profiles(id),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    label TEXT,
    weekday TEXT,
    start_time TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(course_id, professor_id, location_id)
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','concluida','cancelada')),
    enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, class_id)
  );
  CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    class_date TEXT NOT NULL,
    recorded_by INTEGER NOT NULL REFERENCES users(id),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, class_date)
  );
  CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id),
    status TEXT NOT NULL CHECK(status IN ('presente','ausente','justificado')),
    UNIQUE(session_id, student_id)
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pinned INTEGER NOT NULL DEFAULT 0,
    requires_confirmation INTEGER NOT NULL DEFAULT 0,
    action_url TEXT,
    action_label TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS announcement_reads (
    announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    confirmed INTEGER NOT NULL DEFAULT 0,
    read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(announcement_id,user_id)
  );
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_user_id INTEGER NOT NULL REFERENCES users(id),
    subject TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Normal','Alta','Urgente')),
    status TEXT NOT NULL DEFAULT 'Aberto' CHECK(status IN ('Aberto','Pendente','Resolvido')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author_user_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS dropout_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    class_id INTEGER NOT NULL REFERENCES classes(id),
    reason TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const sha256 = value => createHash('sha256').update(value).digest('hex');
const cleanEmail = value => String(value || '').trim().toLowerCase();
const publicUser = user => ({ id: user.id, nome: user.name, email: user.email, role: user.role });
const strongPassword = value => typeof value === 'string' && value.length >= 10 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [, saltHex, hashHex] = String(encoded).split('$');
  if (!saltHex || !hashHex) return false;
  const derived = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64));
  const expected = Buffer.from(hashHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

async function seedUser(name, email, password, role) {
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return;
  db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
    .run(name, email, await hashPassword(password), role);
}

await seedUser('Admin Regional', 'gestor@projetoaprendiz.local', 'Gestor@2026!', 'gestor');
await seedUser('Marina Oliveira', 'professor@projetoaprendiz.local', 'Professor@2026!', 'professor');

function seedAcademicData() {
  const locationNames = ['Pituba', 'Brotas', 'Lauro de Freitas', 'Guarani', 'Boca do Rio', 'Alto de Coutos', 'Remoto'];
  const courseNames = ['Violão I', 'Teclado', 'Bateria', 'Canto Coral', 'Violino', 'Flauta Transversal', 'Saxofone', 'Contrabaixo', 'Violão II', 'Teoria Musical'];
  for (const name of locationNames) db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)').run(name);
  for (const name of courseNames) db.prepare('INSERT OR IGNORE INTO courses (name) VALUES (?)').run(name);

  const professorUser = db.prepare('SELECT id FROM users WHERE email = ?').get('professor@projetoaprendiz.local');
  const profiles = [
    ['Marina Oliveira','professor@projetoaprendiz.local','(71) 98888-1000','Pituba',professorUser.id],
    ['João Silva','joao.silva@projetoaprendiz.local','(71) 98888-1111','Pituba',null],
    ['Carlos Souza','carlos.souza@projetoaprendiz.local','(71) 98888-3333','Lauro de Freitas',null],
    ['Ana Costa','ana.costa@projetoaprendiz.local','(71) 98888-4444','Pituba',null],
    ['Pedro Santos','pedro.santos@projetoaprendiz.local','(71) 98888-5555','Brotas',null],
  ];
  for (const [name,email,phone,location,userId] of profiles) {
    const locationId = db.prepare('SELECT id FROM locations WHERE name = ?').get(location).id;
    db.prepare('INSERT OR IGNORE INTO professor_profiles (user_id,name,email,phone,home_location_id) VALUES (?,?,?,?,?)').run(userId,name,email,phone,locationId);
  }

  const offerings = [
    ['Violão I','Pituba','Marina Oliveira'], ['Teclado','Brotas','Marina Oliveira'],
    ['Bateria','Lauro de Freitas','Carlos Souza'], ['Canto Coral','Pituba','Ana Costa'],
    ['Violino','Brotas','Pedro Santos'], ['Flauta Transversal','Boca do Rio','Marina Oliveira'],
    ['Saxofone','Brotas','Pedro Santos'], ['Contrabaixo','Alto de Coutos','Carlos Souza'],
    ['Violão II','Pituba','João Silva'], ['Teoria Musical','Remoto','Marina Oliveira'],
  ];
  for (const [course,location,professor] of offerings) {
    const courseId = db.prepare('SELECT id FROM courses WHERE name = ?').get(course).id;
    const locationId = db.prepare('SELECT id FROM locations WHERE name = ?').get(location).id;
    const professorId = db.prepare('SELECT id FROM professor_profiles WHERE name = ?').get(professor).id;
    db.prepare('INSERT OR IGNORE INTO classes (course_id,professor_id,location_id,label,weekday,start_time) VALUES (?,?,?,?,?,?)')
      .run(courseId,professorId,locationId,`${course} — ${location}`,'Sábado','09:00');
  }

  const studentRows = [
    ['João Pereira','joao.pereira@email.com','(71) 98821-1040','ICM Pituba','Jovem',1,'Violão I','Pituba'],
    ['Maria Clara','maria.clara@email.com','(71) 97732-2151','ICM Brotas','Adolescente',0,'Teclado','Brotas'],
    ['Pedro Almeida','pedro.almeida@email.com','(71) 96643-3262','ICM Lauro','Jovem',1,'Bateria','Lauro de Freitas'],
    ['Ana Beatriz','ana.beatriz@email.com','(71) 95554-4373','ICM Pituba','Jovem',0,'Canto Coral','Pituba'],
    ['Lucas Guimarães','lucas.guimaraes@email.com','(71) 94465-5484','ICM Brotas','Adolescente',1,'Violino','Brotas'],
    ['Gabriela Santos','gabriela.santos@email.com','(71) 93376-6595','ICM Boca do Rio','Jovem',1,'Flauta Transversal','Boca do Rio'],
    ['Rafael Souza','rafael.souza@email.com','(71) 92287-7606','ICM Alto de Coutos','Varão',1,'Contrabaixo','Alto de Coutos'],
    ['Juliana Costa','juliana.costa@email.com','(71) 91198-8717','ICM Remoto','Senhora',0,'Teoria Musical','Remoto'],
    ['Ricardo Alves','ricardo.alves@email.com','(71) 90019-9828','ICM Pituba','Varão',1,'Violão II','Pituba'],
    ['Camila Rocha','camila.rocha@email.com','(71) 98920-0939','ICM Brotas','Jovem',1,'Saxofone','Brotas'],
    ['Bruno Lima','bruno.lima@email.com','(71) 97831-1050','ICM Pituba','Adolescente',0,'Violão I','Pituba'],
    ['Larissa Melo','larissa.melo@email.com','(71) 96742-2161','ICM Brotas','Jovem',0,'Teclado','Brotas'],
  ];
  for (const [name,email,phone,church,ageGroup,instrument,course,location] of studentRows) {
    db.prepare('INSERT OR IGNORE INTO students (name,email,phone,church,age_group,has_instrument) VALUES (?,?,?,?,?,?)')
      .run(name,email,phone,church,ageGroup,instrument);
    const studentId = db.prepare('SELECT id FROM students WHERE email = ?').get(email).id;
    const classRow = db.prepare(`SELECT classes.id FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE courses.name=? AND locations.name=?`).get(course,location);
    if (classRow) db.prepare('INSERT OR IGNORE INTO enrollments (student_id,class_id) VALUES (?,?)').run(studentId,classRow.id);
  }
}

seedAcademicData();

function seedCommunicationData() {
  const gestor = db.prepare('SELECT id FROM users WHERE role=? ORDER BY id LIMIT 1').get('gestor');
  const professor = db.prepare('SELECT id FROM users WHERE email=?').get('professor@projetoaprendiz.local');
  if (!db.prepare('SELECT id FROM announcements LIMIT 1').get()) {
    const rows = [
      ['Reunião pedagógica','Urgente','A reunião mensal será realizada na sexta-feira, às 18h.','2026-08-24T12:00:00Z',1,1],
      ['Recital de primavera','Eventos','As inscrições para apresentações estão abertas até 5 de setembro.','2026-08-20T12:00:00Z',1,0],
      ['Atualização do calendário','Geral','O calendário de aulas e reposições do próximo mês já está disponível.','2026-08-17T12:00:00Z',0,0],
      ['Novos materiais didáticos','Inscrições','Os materiais complementares foram adicionados à biblioteca.','2026-08-12T12:00:00Z',0,0],
    ];
    for (const [title,category,content,scheduled,pinned,confirmation] of rows) {
      db.prepare('INSERT INTO announcements (author_user_id,title,category,content,scheduled_at,published_at,pinned,requires_confirmation) VALUES (?,?,?,?,?,?,?,?)')
        .run(gestor.id,title,category,content,scheduled,scheduled,pinned,confirmation);
    }
  }
  if (!db.prepare('SELECT id FROM support_tickets LIMIT 1').get()) {
    const tickets = [
      ['Ajuste na lista de chamada','Alta','Um aluno novo ainda não aparece na turma de Violão I.','Aberto','2026-08-23T14:30:00Z'],
      ['Projetor da sala 3','Normal','O projetor está com a imagem oscilando.','Pendente','2026-08-18T09:15:00Z'],
      ['Material de teoria musical','Normal','Solicitação de novas cópias das apostilas.','Resolvido','2026-08-02T10:00:00Z'],
    ];
    for (const [subject,priority,message,status,created] of tickets) {
      const result=db.prepare('INSERT INTO support_tickets (requester_user_id,subject,priority,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(professor.id,subject,priority,status,created,created);
      db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body,created_at) VALUES (?,?,?,?)').run(result.lastInsertRowid,professor.id,message,created);
    }
  }
  if (!db.prepare('SELECT id FROM dropout_events LIMIT 1').get()) {
    const historical = [
      ['Fernando Mendes','fernando.mendes@email.com','Saxofone','Brotas','Conflito de horários','2026-04-22'],
      ['Gustavo Rocha','gustavo.rocha@email.com','Contrabaixo','Alto de Coutos','Questões pessoais','2026-03-30'],
    ];
    for(const [name,email,course,location,reason,date] of historical){
      db.prepare('INSERT OR IGNORE INTO students (name,email,active) VALUES (?,?,0)').run(name,email);
      const studentId=db.prepare('SELECT id FROM students WHERE email=?').get(email).id;
      const classRow=db.prepare(`SELECT classes.id FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE courses.name=? AND locations.name=?`).get(course,location);
      db.prepare("INSERT OR IGNORE INTO enrollments (student_id,class_id,status,enrolled_at) VALUES (?,?,'cancelada','2026-02-01')").run(studentId,classRow.id);
      db.prepare('INSERT INTO dropout_events (student_id,class_id,reason,occurred_at) VALUES (?,?,?,?)').run(studentId,classRow.id,reason,date);
    }
  }
}

seedCommunicationData();
db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
db.prepare('DELETE FROM password_resets WHERE expires_at <= ? OR used_at IS NOT NULL').run(new Date().toISOString());

const attempts = new Map();
function limited(key, maximum, windowMs) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter(time => now - time < windowMs);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > maximum;
}

function cookies(request) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').map(value => value.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2));
}

function cookie(name, value, maxAge = 0) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isProduction ? '; Secure' : ''}`;
}

function securityHeaders(contentType = 'application/json; charset=utf-8') {
  return {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    'Cache-Control': 'no-store',
  };
}

function json(response, status, data, extra = {}) {
  response.writeHead(status, { ...securityHeaders(), ...extra });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 32768) throw new Error('PAYLOAD_TOO_LARGE');
  }
  return body ? JSON.parse(body) : {};
}

function currentSession(request) {
  const raw = cookies(request).pa_session;
  if (!raw) return null;
  return db.prepare(`
    SELECT sessions.*, users.id AS user_id, users.name, users.email, users.role, users.active
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(sha256(raw), new Date().toISOString()) || null;
}

function originAllowed(request) {
  const origin = request.headers.origin;
  return !origin || origin === baseUrl;
}

function authorize(request, response, roles = []) {
  const session = currentSession(request);
  if (!session || !session.active) {
    json(response, 401, { message: 'Faça login para continuar.' });
    return null;
  }
  if (roles.length && !roles.includes(session.role)) {
    json(response, 403, { message: 'Você não tem permissão para esta operação.' });
    return null;
  }
  if (['POST','PUT','PATCH','DELETE'].includes(request.method) && request.headers['x-csrf-token'] !== session.csrf_token) {
    json(response, 403, { message: 'Validação de segurança expirada. Atualize a página.' });
    return null;
  }
  return session;
}

function studentView(row) {
  const courseNames = row.course_names ? row.course_names.split('||') : [];
  const locations = row.location_names ? row.location_names.split('||') : [];
  return {
    id: row.id, nome: row.name, email: row.email, contato: row.email,
    telefone: row.phone || '', igreja: row.church || '', classe: row.age_group || '',
    instrumento: row.has_instrument ? 'Sim' : 'Não', curso: courseNames,
    local: locations[0] || '', foto_url: '',
    cursos: courseNames.map((nome, index) => ({ nome, local: locations[index] || '' })),
    created_at: row.created_at,
  };
}

const studentSelect = `
  SELECT students.*,
    GROUP_CONCAT(courses.name, '||') AS course_names,
    GROUP_CONCAT(locations.name, '||') AS location_names
  FROM students
  LEFT JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa'
  LEFT JOIN classes ON classes.id=enrollments.class_id AND classes.active=1
  LEFT JOIN courses ON courses.id=classes.course_id
  LEFT JOIN locations ON locations.id=classes.location_id
`;

async function api(request, response, url) {
  const ip = request.socket.remoteAddress || 'local';
  if (['POST','PUT','PATCH','DELETE'].includes(request.method) && !originAllowed(request)) {
    return json(response, 403, { message: 'Origem não autorizada.' });
  }

  if (request.method === 'GET' && url.pathname === '/api/health') return json(response, 200, { status: 'ok' });

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    const { email, password, remember = false } = await readJson(request);
    const normalized = cleanEmail(email);
    if (limited(`login:${ip}:${normalized}`, 5, 15 * 60_000)) return json(response, 429, { message: 'Muitas tentativas. Aguarde alguns minutos.' });
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(normalized);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      await new Promise(resolve => setTimeout(resolve, 350));
      return json(response, 401, { message: 'E-mail ou senha inválidos.' });
    }
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(24).toString('base64url');
    const maxAge = remember ? 30 * 86400 : 8 * 3600;
    const expires = new Date(Date.now() + maxAge * 1000).toISOString();
    db.prepare('INSERT INTO sessions (user_id,token_hash,csrf_token,expires_at) VALUES (?,?,?,?)').run(user.id, sha256(token), csrfToken, expires);
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(user.id, 'login', ip);
    return json(response, 200, { user: publicUser(user), csrfToken }, { 'Set-Cookie': cookie('pa_session', token, maxAge) });
  }

  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    const session = currentSession(request);
    if (!session || !session.active) return json(response, 401, { message: 'Sessão não autenticada.' });
    return json(response, 200, { user: publicUser({ id: session.user_id, ...session }), csrfToken: session.csrf_token });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    const session = currentSession(request);
    if (session && request.headers['x-csrf-token'] === session.csrf_token) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);
      db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id, 'logout', ip);
    }
    return json(response, 200, { success: true }, { 'Set-Cookie': cookie('pa_session', '', 0) });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
    const { email } = await readJson(request);
    const normalized = cleanEmail(email);
    if (!limited(`reset:${ip}:${normalized}`, 3, 30 * 60_000)) {
      const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(normalized);
      if (user) {
        const token = randomBytes(32).toString('base64url');
        const expires = new Date(Date.now() + 30 * 60_000).toISOString();
        db.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').run(user.id);
        db.prepare('INSERT INTO password_resets (user_id,token_hash,expires_at) VALUES (?,?,?)').run(user.id, sha256(token), expires);
        const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
        const body = `Olá, ${user.name}. Use este link em até 30 minutos para redefinir sua senha:\n\n${resetUrl}\n\nSe você não solicitou a alteração, ignore esta mensagem.`;
        db.prepare('INSERT INTO dev_emails (recipient,subject,body) VALUES (?,?,?)').run(user.email, 'Recuperação de senha — Projeto Aprendiz', body);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    return json(response, 200, { message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.', devMailbox: isProduction ? null : '/dev-mail' });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    const { token, password } = await readJson(request);
    if (!strongPassword(password)) return json(response, 400, { message: 'A senha não atende aos requisitos de segurança.' });
    const reset = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').get(sha256(String(token || '')), new Date().toISOString());
    if (!reset) return json(response, 400, { message: 'Este link é inválido, expirou ou já foi utilizado.' });
    const passwordHash = await hashPassword(password);
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, reset.user_id);
      db.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(reset.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(reset.user_id);
      db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(reset.user_id, 'password_reset', ip);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return json(response, 200, { message: 'Senha alterada com sucesso.' });
  }

  if (request.method === 'GET' && url.pathname === '/api/invitations/validate') {
    const invitation = db.prepare(`SELECT professor_invites.*,professor_profiles.name FROM professor_invites JOIN professor_profiles ON professor_profiles.id=professor_invites.professor_profile_id WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?`).get(sha256(String(url.searchParams.get('token') || '')),new Date().toISOString());
    if(!invitation)return json(response,400,{message:'Este convite é inválido, expirou ou já foi utilizado.'});
    return json(response,200,{nome:invitation.name,email:invitation.email,expiresAt:invitation.expires_at});
  }

  if (request.method === 'POST' && url.pathname === '/api/invitations/accept') {
    const body=await readJson(request),token=String(body.token||'');
    if(!strongPassword(body.password))return json(response,400,{message:'A senha não atende aos requisitos de segurança.'});
    const invitation=db.prepare(`SELECT professor_invites.*,professor_profiles.name FROM professor_invites JOIN professor_profiles ON professor_profiles.id=professor_invites.professor_profile_id WHERE token_hash=? AND accepted_at IS NULL AND expires_at>?`).get(sha256(token),new Date().toISOString());
    if(!invitation)return json(response,400,{message:'Este convite é inválido, expirou ou já foi utilizado.'});
    if(db.prepare('SELECT id FROM users WHERE email=?').get(invitation.email))return json(response,409,{message:'Já existe uma conta com este e-mail.'});
    const passwordHash=await hashPassword(body.password);
    db.exec('BEGIN');
    try{
      const userResult=db.prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'professor')").run(invitation.name,invitation.email,passwordHash);
      const userId=Number(userResult.lastInsertRowid);
      db.prepare('UPDATE professor_profiles SET user_id=? WHERE id=?').run(userId,invitation.professor_profile_id);
      db.prepare('UPDATE professor_invites SET accepted_at=CURRENT_TIMESTAMP WHERE id=?').run(invitation.id);
      db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(userId,'professor_invite_accepted',ip);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    return json(response,200,{message:'Conta ativada com sucesso. Você já pode entrar.'});
  }

  if(request.method==='GET'&&url.pathname==='/api/account'){
    const session=authorize(request,response,['gestor','professor']);if(!session)return;
    const row=db.prepare('SELECT preferences_json FROM user_settings WHERE user_id=?').get(session.user_id);
    let preferences={};try{preferences=JSON.parse(row?.preferences_json||'{}')}catch{}
    return json(response,200,{user:publicUser({id:session.user_id,...session}),preferences});
  }
  if(request.method==='PUT'&&url.pathname==='/api/account/profile'){
    const session=authorize(request,response,['gestor','professor']);if(!session)return;
    const body=await readJson(request),name=String(body.nome||'').trim(),email=cleanEmail(body.email);
    if(!name||!email||!email.includes('@'))return json(response,400,{message:'Informe nome e e-mail válidos.'});
    try{
      db.exec('BEGIN');
      db.prepare('UPDATE users SET name=?,email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(name,email,session.user_id);
      if(session.role==='professor')db.prepare('UPDATE professor_profiles SET name=?,email=? WHERE user_id=?').run(name,email,session.user_id);
      db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'profile_updated',ip);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');if(String(error).includes('UNIQUE'))return json(response,409,{message:'Este e-mail já está em uso.'});throw error;}
    return json(response,200,{user:{id:session.user_id,nome:name,email,role:session.role}});
  }
  if(request.method==='PUT'&&url.pathname==='/api/account/password'){
    const session=authorize(request,response,['gestor','professor']);if(!session)return;
    const body=await readJson(request),user=db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);
    if(!(await verifyPassword(body.currentPassword,user.password_hash)))return json(response,400,{message:'A senha atual está incorreta.'});
    if(!strongPassword(body.newPassword))return json(response,400,{message:'A nova senha não atende aos requisitos de segurança.'});
    db.prepare('UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(await hashPassword(body.newPassword),session.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id=? AND id<>?').run(session.user_id,session.id);
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'password_changed',ip);
    return json(response,200,{message:'Senha alterada com sucesso.'});
  }
  if(request.method==='PUT'&&url.pathname==='/api/account/preferences'){
    const session=authorize(request,response,['gestor','professor']);if(!session)return;
    const body=await readJson(request),preferences=body.preferences&&typeof body.preferences==='object'?body.preferences:{};
    db.prepare(`INSERT INTO user_settings (user_id,preferences_json) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET preferences_json=excluded.preferences_json,updated_at=CURRENT_TIMESTAMP`).run(session.user_id,JSON.stringify(preferences));
    return json(response,200,{preferences});
  }

  if (request.method === 'GET' && url.pathname === '/alunos') {
    if (!authorize(request, response, ['gestor'])) return;
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 10)));
    const search = `%${String(url.searchParams.get('search') || '').trim()}%`;
    const total = db.prepare('SELECT COUNT(*) AS total FROM students WHERE active=1 AND (name LIKE ? OR email LIKE ?)').get(search,search).total;
    const rows = db.prepare(`${studentSelect} WHERE students.active=1 AND (students.name LIKE ? OR students.email LIKE ?) GROUP BY students.id ORDER BY students.name LIMIT ? OFFSET ?`).all(search,search,limit,(page-1)*limit);
    return json(response, 200, { alunos: rows.map(studentView), total });
  }

  if (request.method === 'POST' && url.pathname === '/alunos') {
    const session = authorize(request, response, ['gestor']); if (!session) return;
    const body = await readJson(request);
    const name = String(body.nome || '').trim(), email = cleanEmail(body.contato || body.email);
    if (!name || !email || !String(body.telefone || '').trim()) return json(response, 400, { message: 'Nome, e-mail e telefone são obrigatórios.' });
    const courseName = Array.isArray(body.curso) ? body.curso[0] : body.curso;
    const classRow = db.prepare(`SELECT classes.id FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE courses.name=? AND locations.name=? AND classes.active=1`).get(courseName,body.local);
    if (!classRow) return json(response, 400, { message: 'Não existe uma turma ativa para o curso e local selecionados.' });
    try {
      const result = db.prepare('INSERT INTO students (name,email,phone,church,age_group,has_instrument) VALUES (?,?,?,?,?,?)').run(name,email,body.telefone,body.igreja || '',body.classe || '',body.instrumento === 'Sim' ? 1 : 0);
      db.prepare('INSERT INTO enrollments (student_id,class_id) VALUES (?,?)').run(result.lastInsertRowid,classRow.id);
      db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_created',ip);
      return json(response, 201, { id: Number(result.lastInsertRowid) });
    } catch (error) {
      if (String(error).includes('UNIQUE')) return json(response, 409, { message: 'Já existe um aluno com este e-mail.' });
      throw error;
    }
  }

  const studentMatch = url.pathname.match(/^\/alunos\/(\d+)$/);
  if (studentMatch && request.method === 'PUT') {
    const session = authorize(request, response, ['gestor']); if (!session) return;
    const id = Number(studentMatch[1]), body = await readJson(request);
    const courseName = Array.isArray(body.curso) ? body.curso[0] : body.curso;
    const classRow = db.prepare(`SELECT classes.id FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE courses.name=? AND locations.name=? AND classes.active=1`).get(courseName,body.local);
    if (!classRow) return json(response, 400, { message: 'Não existe uma turma ativa para o curso e local selecionados.' });
    try {
      db.prepare(`UPDATE students SET name=?,email=?,phone=?,church=?,age_group=?,has_instrument=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1`)
        .run(String(body.nome||'').trim(),cleanEmail(body.contato||body.email),body.telefone||'',body.igreja||'',body.classe||'',body.instrumento==='Sim'?1:0,id);
      db.prepare("UPDATE enrollments SET status='cancelada' WHERE student_id=? AND status='ativa'").run(id);
      db.prepare(`INSERT INTO enrollments (student_id,class_id,status) VALUES (?,?,'ativa') ON CONFLICT(student_id,class_id) DO UPDATE SET status='ativa'`).run(id,classRow.id);
      db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_updated',ip);
      return json(response, 200, { success: true });
    } catch (error) {
      if (String(error).includes('UNIQUE')) return json(response, 409, { message: 'Já existe um aluno com este e-mail.' });
      throw error;
    }
  }
  if (studentMatch && request.method === 'DELETE') {
    const session = authorize(request, response, ['gestor']); if (!session) return;
    db.prepare('UPDATE students SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(Number(studentMatch[1]));
    db.prepare("UPDATE enrollments SET status='cancelada' WHERE student_id=?").run(Number(studentMatch[1]));
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'student_deactivated',ip);
    return json(response, 200, { success: true });
  }

  if (request.method === 'GET' && (url.pathname === '/professores/meus-alunos' || url.pathname === '/api/professores/me/alunos')) {
    const session = authorize(request, response, ['professor']); if (!session) return;
    const page = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = url.pathname.startsWith('/api/') ? 100 : Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 10)));
    const search = `%${String(url.searchParams.get('search') || '').trim()}%`;
    const profile = db.prepare('SELECT id FROM professor_profiles WHERE user_id=? AND active=1').get(session.user_id);
    if (!profile) return json(response, 403, { message: 'Perfil de professor não configurado.' });
    const total = db.prepare(`SELECT COUNT(DISTINCT students.id) AS total FROM students JOIN enrollments ON enrollments.student_id=students.id JOIN classes ON classes.id=enrollments.class_id WHERE students.active=1 AND enrollments.status='ativa' AND classes.active=1 AND classes.professor_id=? AND (students.name LIKE ? OR students.email LIKE ?)`).get(profile.id,search,search).total;
    const rows = db.prepare(`${studentSelect} WHERE students.active=1 AND students.id IN (SELECT enrollments.student_id FROM enrollments JOIN classes ON classes.id=enrollments.class_id WHERE enrollments.status='ativa' AND classes.active=1 AND classes.professor_id=?) AND (students.name LIKE ? OR students.email LIKE ?) GROUP BY students.id ORDER BY students.name LIMIT ? OFFSET ?`).all(profile.id,search,search,limit,(page-1)*limit);
    return json(response, 200, { alunos: rows.map(studentView), total });
  }

  if (request.method === 'GET' && url.pathname === '/cursos') {
    if (!authorize(request, response, ['gestor'])) return;
    const rows = db.prepare(`SELECT classes.id,courses.name AS nome,locations.name AS local,professor_profiles.name AS professor,CASE classes.active WHEN 1 THEN 'Ativo' ELSE 'Inativo' END AS status,COUNT(CASE WHEN enrollments.status='ativa' AND students.active=1 THEN 1 END) AS alunos FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id LEFT JOIN enrollments ON enrollments.class_id=classes.id LEFT JOIN students ON students.id=enrollments.student_id GROUP BY classes.id ORDER BY courses.name,locations.name`).all();
    const professores = db.prepare('SELECT name FROM professor_profiles WHERE active=1 ORDER BY name').all().map(row=>row.name);
    const locais = db.prepare('SELECT name FROM locations WHERE active=1 ORDER BY name').all().map(row=>row.name);
    return json(response, 200, { cursos: rows, professores, locais });
  }

  if (request.method === 'POST' && url.pathname === '/cursos') {
    const session = authorize(request, response, ['gestor']); if (!session) return;
    const body = await readJson(request);
    const professor = db.prepare('SELECT id FROM professor_profiles WHERE name=? AND active=1').get(body.professor);
    if (!professor) return json(response, 400, { message: 'Professor não encontrado.' });
    db.prepare('INSERT OR IGNORE INTO courses (name) VALUES (?)').run(String(body.nome||'').trim());
    db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)').run(String(body.local||'').trim());
    const courseId=db.prepare('SELECT id FROM courses WHERE name=?').get(body.nome).id, locationId=db.prepare('SELECT id FROM locations WHERE name=?').get(body.local).id;
    try {
      const result=db.prepare('INSERT INTO classes (course_id,professor_id,location_id,label) VALUES (?,?,?,?)').run(courseId,professor.id,locationId,`${body.nome} — ${body.local}`);
      db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_created',ip);
      return json(response,201,{id:Number(result.lastInsertRowid)});
    } catch (error) {
      if (String(error).includes('UNIQUE')) return json(response,409,{message:'Esta turma já existe.'});
      throw error;
    }
  }
  const courseMatch=url.pathname.match(/^\/cursos\/(\d+)$/);
  if (courseMatch && request.method==='PUT') {
    const session=authorize(request,response,['gestor']); if(!session)return;
    const id=Number(courseMatch[1]),body=await readJson(request);
    const professor=db.prepare('SELECT id FROM professor_profiles WHERE name=? AND active=1').get(body.professor);
    if(!professor)return json(response,400,{message:'Professor não encontrado.'});
    db.prepare('INSERT OR IGNORE INTO courses (name) VALUES (?)').run(body.nome);
    db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)').run(body.local);
    const courseId=db.prepare('SELECT id FROM courses WHERE name=?').get(body.nome).id,locationId=db.prepare('SELECT id FROM locations WHERE name=?').get(body.local).id;
    db.prepare('UPDATE classes SET course_id=?,professor_id=?,location_id=?,label=? WHERE id=?').run(courseId,professor.id,locationId,`${body.nome} — ${body.local}`,id);
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_updated',ip);
    return json(response,200,{success:true});
  }
  if(courseMatch&&request.method==='DELETE'){
    const session=authorize(request,response,['gestor']);if(!session)return;
    db.prepare('UPDATE classes SET active=0 WHERE id=?').run(Number(courseMatch[1]));
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'class_deactivated',ip);
    return json(response,200,{success:true});
  }

  if(request.method==='GET'&&url.pathname==='/professores'){
    if(!authorize(request,response,['gestor']))return;
    const rows=db.prepare(`SELECT professor_profiles.id,professor_profiles.name AS nome,professor_profiles.email AS contato,professor_profiles.phone AS telefone,locations.name AS local,CASE professor_profiles.active WHEN 1 THEN 'Ativo' ELSE 'Inativo' END AS status,GROUP_CONCAT(DISTINCT courses.name) AS course_names FROM professor_profiles LEFT JOIN locations ON locations.id=professor_profiles.home_location_id LEFT JOIN classes ON classes.professor_id=professor_profiles.id AND classes.active=1 LEFT JOIN courses ON courses.id=classes.course_id GROUP BY professor_profiles.id ORDER BY professor_profiles.name`).all().map(row=>({...row,cursos:row.course_names?row.course_names.split(','):[]}));
    const cursos=db.prepare('SELECT name FROM courses WHERE active=1 ORDER BY name').all().map(row=>row.name);
    const locais=db.prepare('SELECT name FROM locations WHERE active=1 ORDER BY name').all().map(row=>row.name);
    return json(response,200,{professores:rows,cursos,locais});
  }

  if(request.method==='POST'&&url.pathname==='/professores'){
    const session=authorize(request,response,['gestor']);if(!session)return;
    const body=await readJson(request),name=String(body.nome||'').trim(),email=cleanEmail(body.contato);
    if(!name||!email||!body.local)return json(response,400,{message:'Nome, e-mail e local são obrigatórios.'});
    db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)').run(body.local);
    const locationId=db.prepare('SELECT id FROM locations WHERE name=?').get(body.local).id;
    try{
      db.exec('BEGIN');
      const result=db.prepare('INSERT INTO professor_profiles (name,email,phone,home_location_id) VALUES (?,?,?,?)').run(name,email,body.telefone||'',locationId);
      const professorId=Number(result.lastInsertRowid);
      for(const courseName of body.cursos||[]){
        db.prepare('INSERT OR IGNORE INTO courses (name) VALUES (?)').run(courseName);
        const courseId=db.prepare('SELECT id FROM courses WHERE name=?').get(courseName).id;
        db.prepare('INSERT OR IGNORE INTO classes (course_id,professor_id,location_id,label) VALUES (?,?,?,?)').run(courseId,professorId,locationId,`${courseName} — ${body.local}`);
      }
      const token=randomBytes(32).toString('base64url'),expires=new Date(Date.now()+48*60*60_000).toISOString();
      db.prepare('INSERT INTO professor_invites (professor_profile_id,email,token_hash,expires_at,created_by) VALUES (?,?,?,?,?)').run(professorId,email,sha256(token),expires,session.user_id);
      const inviteUrl=`${baseUrl}/accept-invite?token=${encodeURIComponent(token)}`;
      const emailBody=`Olá, ${name}. Você foi convidado para acessar o Projeto Aprendiz como Professor. Crie sua senha em até 48 horas:\n\n${inviteUrl}\n\nSe você não reconhece este convite, ignore esta mensagem.`;
      db.prepare('INSERT INTO dev_emails (recipient,subject,body) VALUES (?,?,?)').run(email,'Convite de acesso — Projeto Aprendiz',emailBody);
      db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'professor_created',ip);
      db.exec('COMMIT');
      return json(response,201,{id:professorId,message:'Professor cadastrado e convite enviado.',devMailbox:isProduction?null:'/dev-mail'});
    }catch(error){
      try{db.exec('ROLLBACK')}catch{}
      if(String(error).includes('UNIQUE'))return json(response,409,{message:'Já existe um professor com este e-mail.'});
      throw error;
    }
  }

  const professorMatch=url.pathname.match(/^\/professores\/(\d+)$/);
  if(professorMatch&&request.method==='PUT'){
    const session=authorize(request,response,['gestor']);if(!session)return;
    const id=Number(professorMatch[1]),body=await readJson(request);
    db.prepare('INSERT OR IGNORE INTO locations (name) VALUES (?)').run(body.local);
    const locationId=db.prepare('SELECT id FROM locations WHERE name=?').get(body.local).id;
    try{
      db.prepare('UPDATE professor_profiles SET name=?,email=?,phone=?,home_location_id=? WHERE id=?').run(String(body.nome||'').trim(),cleanEmail(body.contato),body.telefone||'',locationId,id);
      for(const courseName of body.cursos||[]){
        db.prepare('INSERT OR IGNORE INTO courses (name) VALUES (?)').run(courseName);
        const courseId=db.prepare('SELECT id FROM courses WHERE name=?').get(courseName).id;
        db.prepare('INSERT OR IGNORE INTO classes (course_id,professor_id,location_id,label) VALUES (?,?,?,?)').run(courseId,id,locationId,`${courseName} — ${body.local}`);
      }
      db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'professor_updated',ip);
      return json(response,200,{success:true});
    }catch(error){
      if(String(error).includes('UNIQUE'))return json(response,409,{message:'Já existe um professor com este e-mail.'});
      throw error;
    }
  }
  if(professorMatch&&request.method==='DELETE'){
    const session=authorize(request,response,['gestor']);if(!session)return;
    const id=Number(professorMatch[1]);
    const activeClasses=db.prepare('SELECT COUNT(*) AS total FROM classes WHERE professor_id=? AND active=1').get(id).total;
    if(activeClasses)return json(response,409,{message:'Reatribua ou desative as turmas deste professor antes de desativá-lo.'});
    db.prepare('UPDATE professor_profiles SET active=0 WHERE id=?').run(id);
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'professor_deactivated',ip);
    return json(response,200,{success:true});
  }

  if(request.method==='GET'&&url.pathname==='/professores/meus-cursos'){
    const session=authorize(request,response,['professor']);if(!session)return;
    const rows=db.prepare(`SELECT classes.id,courses.name AS nome,locations.name AS local FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=? AND classes.active=1 ORDER BY courses.name`).all(session.user_id);
    return json(response,200,rows);
  }

  if(request.method==='GET'&&url.pathname==='/frequencia'){
    const session=authorize(request,response,['professor']);if(!session)return;
    const classId=Number(url.searchParams.get('curso_id')),date=url.searchParams.get('data');
    const owned=db.prepare(`SELECT classes.id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE classes.id=? AND professor_profiles.user_id=? AND classes.active=1`).get(classId,session.user_id);
    if(!owned)return json(response,403,{message:'Turma não vinculada a este professor.'});
    const rows=db.prepare(`SELECT students.id,students.name AS nome,COALESCE(attendance_records.status,'presente') AS status FROM students JOIN enrollments ON enrollments.student_id=students.id AND enrollments.status='ativa' LEFT JOIN attendance_sessions ON attendance_sessions.class_id=enrollments.class_id AND attendance_sessions.class_date=? LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id AND attendance_records.student_id=students.id WHERE enrollments.class_id=? AND students.active=1 ORDER BY students.name`).all(date,classId);
    return json(response,200,rows);
  }

  if(request.method==='POST'&&url.pathname==='/frequencia'){
    const session=authorize(request,response,['professor']);if(!session)return;
    const body=await readJson(request),classId=Number(body.curso_id),date=String(body.data_aula||'');
    const owned=db.prepare(`SELECT classes.id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE classes.id=? AND professor_profiles.user_id=? AND classes.active=1`).get(classId,session.user_id);
    if(!owned)return json(response,403,{message:'Turma não vinculada a este professor.'});
    db.prepare(`INSERT INTO attendance_sessions (class_id,class_date,recorded_by) VALUES (?,?,?) ON CONFLICT(class_id,class_date) DO UPDATE SET recorded_by=excluded.recorded_by,updated_at=CURRENT_TIMESTAMP`).run(classId,date,session.user_id);
    const attendanceSession=db.prepare('SELECT id FROM attendance_sessions WHERE class_id=? AND class_date=?').get(classId,date);
    const enrolled=db.prepare("SELECT student_id FROM enrollments WHERE class_id=? AND status='ativa'").all(classId).map(row=>row.student_id);
    const allowed=new Set(enrolled);
    for(const item of body.frequencias||[]){
      const studentId=Number(item.aluno_id),status=String(item.status);
      if(!allowed.has(studentId)||!['presente','ausente','justificado'].includes(status))continue;
      db.prepare(`INSERT INTO attendance_records (session_id,student_id,status) VALUES (?,?,?) ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status`).run(attendanceSession.id,studentId,status);
    }
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'attendance_saved',ip);
    return json(response,200,{success:true});
  }

  if(request.method==='GET'&&url.pathname==='/api/informativos'){
    if(!authorize(request,response,['gestor','professor']))return;
    const rows=db.prepare("SELECT announcements.*,COUNT(announcement_reads.user_id) AS read_count,SUM(CASE announcement_reads.confirmed WHEN 1 THEN 1 ELSE 0 END) AS confirmation_count FROM announcements LEFT JOIN announcement_reads ON announcement_reads.announcement_id=announcements.id WHERE announcements.active=1 GROUP BY announcements.id ORDER BY announcements.pinned DESC,announcements.scheduled_at DESC").all();
    const mapped=rows.map(row=>{
      const date=new Date(row.scheduled_at);
      return {id:row.id,titulo:row.title,categoria:row.category,tipo:row.category==='Urgente'?'Urgente':row.category==='Eventos'?'Evento':'Comunicado',conteudo:row.content,data_publicacao:row.published_at,data:date.toLocaleDateString('pt-BR',{timeZone:'UTC'}),hora:date.toISOString().slice(11,16),lido:row.read_count,confirmacoes:row.confirmation_count,fixado:Boolean(row.pinned),confirmacao:Boolean(row.requires_confirmation),linkUrl:row.action_url||'',linkTexto:row.action_label||''};
    });
    return json(response,200,mapped);
  }
  if(request.method==='POST'&&url.pathname==='/api/informativos'){
    const session=authorize(request,response,['gestor']);if(!session)return;
    const body=await readJson(request),scheduled=body.dataAgendamento+'T'+body.horaAgendamento+':00Z';
    if(!body.titulo||!body.categoria||!body.conteudo||!body.dataAgendamento||!body.horaAgendamento)return json(response,400,{message:'Preencha todos os campos obrigatórios.'});
    const result=db.prepare("INSERT INTO announcements (author_user_id,title,category,content,scheduled_at,published_at,pinned,requires_confirmation,action_url,action_label) VALUES (?,?,?,?,?,?,?,?,?,?)").run(session.user_id,body.titulo,body.categoria,body.conteudo,scheduled,new Date().toISOString(),body.fixarNoTopo?1:0,body.exigirConfirmacao?1:0,body.linkAcao||null,body.textoLink||null);
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'announcement_created',ip);
    return json(response,201,{id:Number(result.lastInsertRowid)});
  }
  const announcementMatch=url.pathname.match(/^\/api\/informativos\/(\d+)$/);
  if(announcementMatch&&request.method==='PUT'){
    const session=authorize(request,response,['gestor']);if(!session)return;
    const body=await readJson(request),scheduled=body.dataAgendamento+'T'+body.horaAgendamento+':00Z';
    db.prepare("UPDATE announcements SET title=?,category=?,content=?,scheduled_at=?,pinned=?,requires_confirmation=?,action_url=?,action_label=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1").run(body.titulo,body.categoria,body.conteudo,scheduled,body.fixarNoTopo?1:0,body.exigirConfirmacao?1:0,body.linkAcao||null,body.textoLink||null,Number(announcementMatch[1]));
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'announcement_updated',ip);
    return json(response,200,{success:true});
  }
  if(announcementMatch&&request.method==='DELETE'){
    const session=authorize(request,response,['gestor']);if(!session)return;
    db.prepare('UPDATE announcements SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(Number(announcementMatch[1]));
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'announcement_deactivated',ip);
    return json(response,200,{success:true});
  }

  if(request.method==='GET'&&url.pathname==='/api/suporte'){
    const session=authorize(request,response,['gestor','professor']);if(!session)return;
    const where=session.role==='professor'?'WHERE support_tickets.requester_user_id=?':'';
    const sql="SELECT support_tickets.*,users.name AS requester_name,users.email AS requester_email,(SELECT body FROM support_messages WHERE ticket_id=support_tickets.id ORDER BY id LIMIT 1) AS first_message FROM support_tickets JOIN users ON users.id=support_tickets.requester_user_id "+where+" ORDER BY CASE support_tickets.status WHEN 'Aberto' THEN 0 WHEN 'Pendente' THEN 1 ELSE 2 END,support_tickets.updated_at DESC";
    const rows=db.prepare(sql).all(...(session.role==='professor'?[session.user_id]:[]));
    const mapped=rows.map(row=>({id:row.id,nome:row.requester_name,contato:row.requester_email,assunto:row.subject,prioridade:row.priority,status:row.status,mensagem:row.first_message,data_abertura:row.created_at,data:new Date(row.created_at).toLocaleDateString('pt-BR')}));
    return json(response,200,mapped);
  }
  if(request.method==='POST'&&url.pathname==='/api/suporte'){
    const session=authorize(request,response,['professor']);if(!session)return;
    const body=await readJson(request);
    if(!body.assunto||!body.mensagem)return json(response,400,{message:'Assunto e mensagem são obrigatórios.'});
    const result=db.prepare('INSERT INTO support_tickets (requester_user_id,subject,priority) VALUES (?,?,?)').run(session.user_id,body.assunto,['Normal','Alta','Urgente'].includes(body.prioridade)?body.prioridade:'Normal');
    db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body) VALUES (?,?,?)').run(result.lastInsertRowid,session.user_id,body.mensagem);
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'ticket_created',ip);
    return json(response,201,{id:Number(result.lastInsertRowid)});
  }
  const replyMatch=url.pathname.match(/^\/api\/suporte\/(\d+)\/responder$/);
  if(replyMatch&&request.method==='POST'){
    const session=authorize(request,response,['gestor','professor']);if(!session)return;
    const id=Number(replyMatch[1]),ticket=db.prepare('SELECT * FROM support_tickets WHERE id=?').get(id);
    if(!ticket||(session.role==='professor'&&ticket.requester_user_id!==session.user_id))return json(response,404,{message:'Ticket não encontrado.'});
    if(ticket.status==='Resolvido')return json(response,409,{message:'Reabra o ticket antes de responder.'});
    const body=await readJson(request);if(!String(body.mensagem||'').trim())return json(response,400,{message:'A resposta não pode estar vazia.'});
    db.prepare('INSERT INTO support_messages (ticket_id,author_user_id,body) VALUES (?,?,?)').run(id,session.user_id,body.mensagem);
    db.prepare("UPDATE support_tickets SET status='Pendente',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(id);
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'ticket_replied',ip);
    return json(response,200,{success:true});
  }
  const closeMatch=url.pathname.match(/^\/api\/suporte\/(\d+)\/fechar$/);
  if(closeMatch&&request.method==='PUT'){
    const session=authorize(request,response,['professor']);if(!session)return;
    const result=db.prepare("UPDATE support_tickets SET status='Resolvido',updated_at=CURRENT_TIMESTAMP WHERE id=? AND requester_user_id=?").run(Number(closeMatch[1]),session.user_id);
    if(!result.changes)return json(response,404,{message:'Ticket não encontrado.'});
    return json(response,200,{success:true});
  }
  const ticketStatusMatch=url.pathname.match(/^\/api\/suporte\/(\d+)\/status$/);
  if(ticketStatusMatch&&request.method==='PUT'){
    const session=authorize(request,response,['gestor']);if(!session)return;
    const body=await readJson(request);
    if(!['Aberto','Pendente','Resolvido'].includes(body.status))return json(response,400,{message:'Status inválido.'});
    db.prepare('UPDATE support_tickets SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(body.status,Number(ticketStatusMatch[1]));
    db.prepare('INSERT INTO audit_log (user_id,action,ip) VALUES (?,?,?)').run(session.user_id,'ticket_status_changed',ip);
    return json(response,200,{success:true});
  }

  if(request.method==='GET'&&url.pathname==='/api/dashboard/gestor'){
    if(!authorize(request,response,['gestor']))return;
    const stats={
      totalAlunos:db.prepare('SELECT COUNT(*) AS total FROM students WHERE active=1').get().total,
      cursosAtivos:db.prepare('SELECT COUNT(*) AS total FROM classes WHERE active=1').get().total,
      professores:db.prepare('SELECT COUNT(*) AS total FROM professor_profiles WHERE active=1').get().total,
      ticketsPendentes:db.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE status<>'Resolvido'").get().total,
    };
    const inscricoesPorCurso=db.prepare("SELECT courses.name AS curso,COUNT(enrollments.id) AS total FROM courses LEFT JOIN classes ON classes.course_id=courses.id AND classes.active=1 LEFT JOIN enrollments ON enrollments.class_id=classes.id AND enrollments.status='ativa' WHERE courses.active=1 GROUP BY courses.id ORDER BY total DESC,courses.name").all();
    const ultimasInscricoes=db.prepare("SELECT students.name AS nome,courses.name AS curso,locations.name AS local,enrollments.enrolled_at FROM enrollments JOIN students ON students.id=enrollments.student_id JOIN classes ON classes.id=enrollments.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE enrollments.status='ativa' ORDER BY enrollments.enrolled_at DESC,enrollments.id DESC LIMIT 6").all();
    const baixaFrequencia=db.prepare(`SELECT students.id,students.name AS nome,students.email AS contato,students.phone AS telefone,students.church AS igreja,students.age_group AS classe,students.has_instrument,courses.name AS curso,locations.name AS local,ROUND(100.0*SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END)/COUNT(attendance_records.id)) AS frequencia FROM attendance_records JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id JOIN students ON students.id=attendance_records.student_id JOIN classes ON classes.id=attendance_sessions.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id WHERE students.active=1 GROUP BY students.id,classes.id HAVING frequencia<75 ORDER BY frequencia,students.name`).all().map(row=>({...row,curso:[row.curso],instrumento:row.has_instrument?'Sim':'Não',status:'Ativo'}));
    return json(response,200,{stats,inscricoesPorCurso,ultimasInscricoes,baixaFrequencia});
  }
  if(request.method==='GET'&&url.pathname==='/api/dashboard/professor'){
    const session=authorize(request,response,['professor']);if(!session)return;
    const totalAlunos=db.prepare("SELECT COUNT(DISTINCT enrollments.student_id) AS total FROM enrollments JOIN classes ON classes.id=enrollments.class_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id JOIN students ON students.id=enrollments.student_id WHERE professor_profiles.user_id=? AND enrollments.status='ativa' AND students.active=1 AND classes.active=1").get(session.user_id).total;
    const proxima=db.prepare('SELECT courses.name AS curso,locations.name AS local,classes.weekday,classes.start_time FROM classes JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=? AND classes.active=1 ORDER BY classes.id LIMIT 1').get(session.user_id);
    const frequency=db.prepare("SELECT COUNT(attendance_records.id) AS total,SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END) AS presencas FROM attendance_records JOIN attendance_sessions ON attendance_sessions.id=attendance_records.session_id JOIN classes ON classes.id=attendance_sessions.class_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=?").get(session.user_id);
    const frequenciaMedia=frequency.total?Math.round(100*frequency.presencas/frequency.total):null;
    const informativos=db.prepare('SELECT COUNT(*) AS total FROM announcements WHERE active=1').get().total;
    const ticketsAbertos=db.prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE requester_user_id=? AND status<>'Resolvido'").get(session.user_id).total;
    return json(response,200,{stats:{totalAlunos,informativos,ticketsAbertos,frequenciaMedia},proximaAula:proxima?{...proxima,descricao:`${proxima.weekday||'A definir'}, ${proxima.start_time||'horário a definir'}`} : null});
  }

  if(request.method==='GET'&&url.pathname==='/api/relatorios/opcoes'){
    if(!authorize(request,response,['gestor','professor']))return;
    return json(response,200,{cursos:db.prepare('SELECT name FROM courses WHERE active=1 ORDER BY name').all().map(row=>row.name),locais:db.prepare('SELECT name FROM locations WHERE active=1 ORDER BY name').all().map(row=>row.name),professores:db.prepare('SELECT name FROM professor_profiles WHERE active=1 ORDER BY name').all().map(row=>row.name)});
  }
  if(request.method==='GET'&&url.pathname==='/api/relatorios/frequencia'){
    const session=authorize(request,response,['gestor','professor']);if(!session)return;
    const conditions=["enrollments.status='ativa'","students.active=1","classes.active=1"],whereParams=[],joinParams=[];
    const filters={curso:url.searchParams.get('curso'),local:url.searchParams.get('local'),professor:url.searchParams.get('professor')};
    if(filters.curso){conditions.push('courses.name=?');whereParams.push(filters.curso)}
    if(filters.local){conditions.push('locations.name=?');whereParams.push(filters.local)}
    if(filters.professor){conditions.push('professor_profiles.name=?');whereParams.push(filters.professor)}
    if(session.role==='professor'){conditions.push('professor_profiles.user_id=?');whereParams.push(session.user_id)}
    const start=url.searchParams.get('dataInicio'),end=url.searchParams.get('dataFim');
    let dateJoin='';
    if(start){dateJoin+=' AND attendance_sessions.class_date>=?';joinParams.push(start)}
    if(end){dateJoin+=' AND attendance_sessions.class_date<=?';joinParams.push(end)}
    const sql="SELECT courses.name AS curso,students.name AS aluno,professor_profiles.name AS professor,locations.name AS local,COUNT(DISTINCT attendance_sessions.id) AS aulas,SUM(CASE WHEN attendance_records.status IN ('presente','justificado') THEN 1 ELSE 0 END) AS presencas FROM enrollments JOIN students ON students.id=enrollments.student_id JOIN classes ON classes.id=enrollments.class_id JOIN courses ON courses.id=classes.course_id JOIN locations ON locations.id=classes.location_id JOIN professor_profiles ON professor_profiles.id=classes.professor_id LEFT JOIN attendance_sessions ON attendance_sessions.class_id=classes.id"+dateJoin+" LEFT JOIN attendance_records ON attendance_records.session_id=attendance_sessions.id AND attendance_records.student_id=students.id WHERE "+conditions.join(' AND ')+" GROUP BY enrollments.id ORDER BY courses.name,students.name";
    const rows=db.prepare(sql).all(...joinParams,...whereParams);
    return json(response,200,rows.map(row=>({curso:row.curso,aluno:row.aluno,professor:row.professor,local:row.local,frequencia:row.aulas?(Math.round(100*row.presencas/row.aulas)+'%'):'Sem aulas'})));
  }
  if(request.method==='GET'&&url.pathname==='/api/relatorios/evasao'){
    if(!authorize(request,response,['gestor']))return;
    const conditions=['1=1'],params=[],course=url.searchParams.get('curso'),start=url.searchParams.get('dataInicio'),end=url.searchParams.get('dataFim');
    if(course){conditions.push('courses.name=?');params.push(course)}
    if(start){conditions.push('dropout_events.occurred_at>=?');params.push(start)}
    if(end){conditions.push('dropout_events.occurred_at<=?');params.push(end)}
    const sql="SELECT courses.name AS curso,students.name AS aluno,enrollments.enrolled_at AS dataInscricao,dropout_events.occurred_at AS dataEvasao,dropout_events.reason AS motivo FROM dropout_events JOIN students ON students.id=dropout_events.student_id JOIN classes ON classes.id=dropout_events.class_id JOIN courses ON courses.id=classes.course_id LEFT JOIN enrollments ON enrollments.student_id=students.id AND enrollments.class_id=classes.id WHERE "+conditions.join(' AND ')+" ORDER BY dropout_events.occurred_at DESC";
    return json(response,200,db.prepare(sql).all(...params));
  }

  return json(response, 404, { message: 'Rota não encontrada.' });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
}

async function serve(request, response, url) {
  if (!isProduction && request.method === 'GET' && url.pathname === '/dev-mail') {
    const emails = db.prepare('SELECT * FROM dev_emails ORDER BY id DESC LIMIT 20').all();
    const cards = emails.map(email => {
      const body = escapeHtml(email.body).replace(/(http:\/\/127\.0\.0\.1:\d+\/(?:reset-password|accept-invite)\?token=[A-Za-z0-9_%.-]+)/g, '<a href="$1">$1</a>');
      return `<article><h2>${escapeHtml(email.subject)}</h2><p><strong>Para:</strong> ${escapeHtml(email.recipient)}</p><pre>${body}</pre></article>`;
    }).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>Caixa de e-mail de testes</title><style>body{font-family:system-ui;max-width:900px;margin:40px auto;padding:0 20px;background:#f5f5f5}article{background:white;padding:24px;margin:20px 0;border-radius:12px;box-shadow:0 2px 10px #0001}pre{white-space:pre-wrap;line-height:1.5}</style><h1>Caixa de e-mail de testes</h1><p>Mensagens geradas apenas neste ambiente local.</p>${cards || '<p>Nenhuma mensagem.</p>'}`;
    response.writeHead(200, securityHeaders('text/html; charset=utf-8'));
    return response.end(html);
  }
  let file = join(distRoot, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, ''));
  try { if (!(await stat(file)).isFile()) throw new Error(); } catch { file = join(distRoot, 'index.html'); }
  try {
    const content = await readFile(file);
    const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml' };
    response.writeHead(200, { ...securityHeaders(types[extname(file)] || 'application/octet-stream'), 'Cache-Control': extname(file) === '.html' ? 'no-store' : 'public, max-age=31536000, immutable' });
    response.end(content);
  } catch { json(response, 503, { message: 'Frontend ainda não compilado.' }); }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, baseUrl);
    if (url.pathname.startsWith('/api/') || ['/alunos','/cursos','/professores','/frequencia'].some(prefix => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
      return await api(request, response, url);
    }
    return await serve(request, response, url);
  } catch (error) {
    console.error(error);
    json(response, error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500, { message: 'Erro interno do servidor.' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Projeto Aprendiz Aprimorado em ${baseUrl}`);
  console.log('Caixa de e-mail de testes em /dev-mail');
});
