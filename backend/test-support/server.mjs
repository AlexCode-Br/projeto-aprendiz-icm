import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

async function availablePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

/** Start an isolated local API. No inherited production integrations or credentials. */
export async function startTestServer({ env = {} } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'aprendiz-test-'));
  const databasePath = join(directory, 'app.db');
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/^(DATABASE_|SUPABASE_|RESEND_|VAPID_|TURNSTILE_|BOOTSTRAP_|REQUIRE_MANAGER_MFA$|AUTH_|SEED_|SQLITE_|APP_URL$|PORT$|HOST$)/i.test(name)));
  let server;
  let output = '';
  let closing;
  const close = () => closing ||= (async () => {
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGTERM');
      await Promise.race([exited, delay(3_000, undefined, { ref: false })]);
      if (server.exitCode === null && server.signalCode === null) {
        server.kill('SIGKILL');
        await Promise.race([exited, delay(3_000, undefined, { ref: false })]);
      }
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  })();
  try {
    const port = await availablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['backend/server.mjs'], {
      cwd: projectRoot,
      env: { ...inherited, NODE_ENV: 'test', AUTH_PROVIDER: 'local', SEED_DEMO_DATA: 'true', REQUIRE_MANAGER_MFA: 'false', ...env, PORT: String(port), HOST: '127.0.0.1', APP_URL: baseUrl, SQLITE_PATH: databasePath },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let startupError;
    server.once('error', error => { startupError = error; });
    const collect = chunk => { output = (output + chunk).slice(-16_000); };
    server.stdout.on('data', collect);
    server.stderr.on('data', collect);
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (startupError) throw startupError;
      if (server.exitCode !== null || server.signalCode !== null) throw new Error(`Servidor de teste encerrou: ${output}`);
      try { ready = (await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1_000) })).ok; } catch {}
      if (ready) break;
      await delay(100);
    }
    if (!ready) throw new Error(`Servidor de teste não iniciou: ${output}`);
    const call = async (session, method, path, body) => {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        signal: AbortSignal.timeout(5_000),
        headers: {
          Origin: baseUrl,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(session?.cookie ? { Cookie: session.cookie } : {}),
          ...(session?.csrf ? { 'X-CSRF-Token': session.csrf } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, data: await response.json().catch(() => ({})), headers: response.headers, cookie: response.headers.get('set-cookie') };
    };
    const login = async (email, password) => {
      const response = await call(null, 'POST', '/api/auth/login', { email, password, remember: true });
      return { response, session: { cookie: (response.cookie || '').split(';')[0], csrf: response.data.csrfToken } };
    };
    return { baseUrl, directory, databasePath, call, login, close, logs: () => output };
  } catch (error) {
    await close();
    throw error;
  }
}
