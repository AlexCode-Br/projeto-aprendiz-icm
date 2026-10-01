import assert from 'node:assert/strict';
import test from 'node:test';
import viteConfig from '../vite.config.js';

test('proxy local encaminha APIs históricas sem interceptar páginas React', () => {
  const prefixes = Object.entries(viteConfig.server.proxy).map(([pattern, target]) => ({ match: new RegExp(pattern), target }));
  for (const path of ['/api/health', '/alunos', '/alunos?page=1', '/alunos/1', '/cursos', '/professores/meus-cursos', '/frequencia?curso=1', '/dev-mail']) {
    assert.equal(prefixes.find(item => item.match.test(path))?.target, 'http://127.0.0.1:4180', path);
  }
  for (const path of ['/login', '/gestor/alunos', '/professor/turmas', '/aluno/cursos', '/configuracoes', '/alunos-extra']) {
    assert.equal(prefixes.some(item => item.match.test(path)), false, path);
  }
});
