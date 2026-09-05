import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSupabaseAuthStorage,
  SUPABASE_AUTH_PERSISTENCE_KEY,
  SUPABASE_AUTH_STORAGE_KEY,
} from '../src/services/supabaseAuthStorage.js';

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
  };
}

test('adaptador preserva uma sessão local legada como acesso lembrado', () => {
  const localStorage = memoryStorage([[SUPABASE_AUTH_STORAGE_KEY, 'legacy-session']]);
  const sessionStorage = memoryStorage();
  const authStorage = createSupabaseAuthStorage({ localStorage, sessionStorage });

  assert.equal(authStorage.isPersistent(), true);
  assert.equal(authStorage.storage.getItem(SUPABASE_AUTH_STORAGE_KEY), 'legacy-session');
  assert.equal(localStorage.getItem(SUPABASE_AUTH_PERSISTENCE_KEY), 'local');
});

test('acesso não lembrado migra e mantém todo o estado Supabase somente na aba', () => {
  const verifierKey = `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`;
  const localStorage = memoryStorage([
    [SUPABASE_AUTH_STORAGE_KEY, 'remembered-session'],
    [verifierKey, 'verifier'],
    ['unrelated', 'keep-me'],
  ]);
  const sessionStorage = memoryStorage();
  const authStorage = createSupabaseAuthStorage({ localStorage, sessionStorage });

  authStorage.setPersistent(false);

  assert.equal(authStorage.isPersistent(), false);
  assert.equal(sessionStorage.getItem(SUPABASE_AUTH_STORAGE_KEY), 'remembered-session');
  assert.equal(sessionStorage.getItem(verifierKey), 'verifier');
  assert.equal(localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY), null);
  assert.equal(localStorage.getItem(verifierKey), null);
  assert.equal(localStorage.getItem(SUPABASE_AUTH_PERSISTENCE_KEY), null);
  assert.equal(localStorage.getItem('unrelated'), 'keep-me');

  authStorage.storage.setItem(SUPABASE_AUTH_STORAGE_KEY, 'new-session');
  assert.equal(sessionStorage.getItem(SUPABASE_AUTH_STORAGE_KEY), 'new-session');
  assert.equal(localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY), null);
});

test('acesso lembrado volta ao armazenamento local e logout limpa as duas áreas', () => {
  const sessionStorage = memoryStorage([[SUPABASE_AUTH_STORAGE_KEY, 'tab-session']]);
  const localStorage = memoryStorage();
  const authStorage = createSupabaseAuthStorage({ localStorage, sessionStorage });

  assert.equal(authStorage.isPersistent(), false);
  authStorage.setPersistent(true);
  assert.equal(authStorage.isPersistent(), true);
  assert.equal(localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY), 'tab-session');
  assert.equal(sessionStorage.getItem(SUPABASE_AUTH_STORAGE_KEY), null);
  assert.equal(localStorage.getItem(SUPABASE_AUTH_PERSISTENCE_KEY), 'local');

  authStorage.clear();
  assert.equal(authStorage.isPersistent(), false);
  assert.equal(localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY), null);
  assert.equal(sessionStorage.getItem(SUPABASE_AUTH_STORAGE_KEY), null);
  assert.equal(localStorage.getItem(SUPABASE_AUTH_PERSISTENCE_KEY), null);
});

test('uma sessão da aba tem precedência sobre estado local sem marcador', () => {
  const localStorage = memoryStorage([[SUPABASE_AUTH_STORAGE_KEY, 'stale-local']]);
  const sessionStorage = memoryStorage([[SUPABASE_AUTH_STORAGE_KEY, 'current-tab']]);
  const authStorage = createSupabaseAuthStorage({ localStorage, sessionStorage });

  assert.equal(authStorage.isPersistent(), false);
  assert.equal(authStorage.storage.getItem(SUPABASE_AUTH_STORAGE_KEY), 'current-tab');
});
