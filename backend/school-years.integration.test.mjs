import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function waitForServer(baseUrl, state) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (state.exitCode !== null) throw new Error(`Servidor encerrou antes do teste: ${state.logs}`);
    try { if ((await fetch(`${baseUrl}/api/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não iniciou: ${state.logs}`);
}

test('períodos letivos atravessam anos, filtram dados e tornam o histórico imutável', { timeout: 40_000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'projeto-aprendiz-school-years-'));
  const databasePath = join(directory, 'school-years.db');
  const port = 47_000 + (process.pid % 1_000);
  const baseUrl = `http://127.0.0.1:${port}`;
  let logs = '';
  const server = spawn(process.execPath, ['backend/server.mjs'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_URL: baseUrl, SQLITE_PATH: databasePath, AUTH_PROVIDER: 'local', SEED_DEMO_DATA: 'true', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { logs += chunk; });
  server.stderr.on('data', chunk => { logs += chunk; });
  const state = { get exitCode() { return server.exitCode; }, get logs() { return logs; } };

  const call = async (session, method, path, body, periodId) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(session?.cookie ? { Cookie: session.cookie } : {}),
        ...(session?.csrf ? { 'X-CSRF-Token': session.csrf } : {}),
        ...(periodId ? { 'X-School-Year-Id': String(periodId) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json().catch(() => ({})), headers: response.headers };
  };

  try {
    await waitForServer(baseUrl, state);
    const login = await call(null, 'POST', '/api/auth/login', { email: 'gestor@projetoaprendiz.local', password: 'Gestor@2026!' });
    assert.equal(login.status, 200, JSON.stringify(login.data));
    const manager = { cookie: String(login.headers.get('set-cookie')).split(';')[0], csrf: login.data.csrfToken };

    const initial = await call(manager, 'GET', '/api/school-years');
    assert.equal(initial.status, 200);
    assert.equal(initial.data.periods.length, 1);
    const legacy = initial.data.periods[0];
    assert.equal(legacy.active, true);
    assert.equal(legacy.datesConfirmed, false);
    assert.match(legacy.label, /datas pendentes/i);

    const legacyClasses = await call(manager, 'GET', '/cursos', undefined, legacy.id);
    assert.ok(legacyClasses.data.cursos.length > 0);
    const offering = legacyClasses.data.cursos[0];

    const configured = await call(manager, 'PUT', `/api/school-years/${legacy.id}`, {
      label: '2026/2027', startDate: '2026-08-10', endDate: '2027-06-30',
    }, legacy.id);
    assert.equal(configured.status, 200, JSON.stringify(configured.data));

    const created = await call(manager, 'POST', '/api/school-years', {
      label: '2027/2028', startDate: '2027-08-09', endDate: '2028-06-29',
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    const nextId = created.data.id;
    assert.equal((await call(manager, 'GET', '/cursos', undefined, nextId)).data.cursos.length, 0);

    const activated = await call(manager, 'PUT', `/api/school-years/${nextId}`, {
      label: '2027/2028', startDate: '2027-08-09', endDate: '2028-06-29', ativar: true,
    }, nextId);
    assert.equal(activated.status, 200, JSON.stringify(activated.data));

    const periods = (await call(manager, 'GET', '/api/school-years')).data.periods;
    assert.equal(periods.filter(period => period.active).length, 1);
    assert.equal(periods.find(period => period.id === nextId).active, true);
    assert.equal(periods.find(period => period.id === legacy.id).closed, true);
    assert.equal((await call(manager, 'PUT', `/api/school-years/${legacy.id}`, {
      label: 'Alteração proibida', startDate: '2026-08-11', endDate: '2027-06-30',
    }, legacy.id)).status, 409);

    assert.ok((await call(manager, 'GET', '/cursos', undefined, legacy.id)).data.cursos.length > 0);
    assert.equal((await call(manager, 'POST', '/cursos', {
      nome: offering.nome, local: offering.local, professor: offering.professor,
    }, legacy.id)).status, 409);
    const newClass = await call(manager, 'POST', '/cursos', {
      nome: offering.nome, local: offering.local, professor: offering.professor,
    }, nextId);
    assert.equal(newClass.status, 201, JSON.stringify(newClass.data));
    assert.equal((await call(manager, 'GET', '/cursos', undefined, nextId)).data.cursos.length, 1);

    const database = new DatabaseSync(databasePath);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM classes WHERE school_year_id IS NULL').get().total, 0);
    assert.equal(database.prepare('SELECT COUNT(*) AS total FROM school_years WHERE active=1').get().total, 1);
    assert.throws(() => database.prepare("INSERT INTO school_years (label,start_date,end_date,active) VALUES ('Conflito','2028-08-01','2029-06-30',1)").run(), /UNIQUE/);
    database.close();
  } finally {
    if (server.exitCode === null) server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

