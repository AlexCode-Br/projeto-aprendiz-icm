import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('PWA inicia na raiz para restaurar ou solicitar autenticação conforme a sessão', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

  // Before `id` existed, browsers derived the installed app identity from the
  // old `/login` start URL. Keep that identity while changing the launch URL.
  assert.equal(manifest.id, '/login');
  assert.equal(manifest.start_url, '/');
  assert.match(serviceWorker, /CACHE_NAME = 'projeto-aprendiz-shell-v8'/);
  assert.match(serviceWorker, /caches\.match\('\/'\)/);
  assert.doesNotMatch(serviceWorker, /caches\.match\('\/login'\)/);
});
