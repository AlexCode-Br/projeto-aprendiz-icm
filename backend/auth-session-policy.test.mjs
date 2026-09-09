import assert from 'node:assert/strict';
import test from 'node:test';
import { canRestoreServerSession } from '../src/services/authSessionPolicy.js';

test('acesso persistente consulta o cookie do aplicativo mesmo sem token Supabase restaurado', () => {
  assert.equal(canRestoreServerSession({
    usesSupabaseAuth: true,
    supabaseSession: null,
    persistentSession: true,
  }), true);
});

test('acesso não persistente termina quando a sessão do navegador desaparece', () => {
  assert.equal(canRestoreServerSession({
    usesSupabaseAuth: true,
    supabaseSession: null,
    persistentSession: false,
  }), false);
});

test('token Supabase da sessão atual continua permitindo a restauração', () => {
  assert.equal(canRestoreServerSession({
    usesSupabaseAuth: true,
    supabaseSession: { access_token: 'token' },
    persistentSession: false,
  }), true);
});
