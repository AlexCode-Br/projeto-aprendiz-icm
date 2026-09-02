import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { emailHref, whatsappHref } from '../shared/contact-links.mjs';

test('links de contato normalizam DDD e não aceitam comandos ou destinatários extras', () => {
    assert.equal(whatsappHref('(71) 98888-4444'), 'https://wa.me/5571988884444');
    assert.equal(whatsappHref('+55 (71) 98888-4444'), 'https://wa.me/5571988884444');
    assert.equal(whatsappHref('5571988884444'), 'https://wa.me/5571988884444');
    assert.equal(whatsappHref('+1 212 555 1234'), 'https://wa.me/12125551234');
    assert.equal(whatsappHref('abc123'), null);
    assert.equal(whatsappHref('123'), null);
    assert.equal(whatsappHref(''), null);
    assert.equal(emailHref(' ana+teste@example.com '), 'mailto:ana%2Bteste@example.com');
    assert.equal(emailHref('ana@example.com?bcc=outro@example.com'), null);
    assert.equal(emailHref('ana@example.com\r\nBcc:outro@example.com'), null);
    assert.equal(emailHref('javascript:alert(1)'), null);
    assert.equal(emailHref('one,two@example.com'), null);
});

test('diretório filtra antes da paginação e detalhes do gestor não expõem frequência', { timeout: 40000 }, async () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const directory = await mkdtemp(join(tmpdir(), 'aprendiz-directory-'));
    const databasePath = join(directory, 'directory.db');
    const port = 54000 + (process.pid % 1000);
    const baseUrl = `http://127.0.0.1:${port}`;
    let logs = '';
    const server = spawn(process.execPath, ['backend/server.mjs'], {
        cwd: root,
        env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_URL: baseUrl, DATABASE_URL: '', SQLITE_PATH: databasePath, AUTH_PROVIDER: 'local', SEED_DEMO_DATA: 'true', NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', chunk => { logs += chunk; });
    server.stderr.on('data', chunk => { logs += chunk; });
    let database;
    const call = async (cookie, path) => {
        const response = await fetch(`${baseUrl}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
        return { status: response.status, data: await response.json() };
    };
    const login = async (email, password) => {
        const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        assert.equal(response.status, 200);
        return String(response.headers.get('set-cookie')).split(';')[0];
    };
    try {
        let ready = false;
        for (let attempt = 0; attempt < 70; attempt++) {
            try { if ((await fetch(`${baseUrl}/api/health`)).ok) { ready = true; break; } } catch {}
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.ok(ready, logs);
        const manager = await login('gestor@projetoaprendiz.local', 'Gestor@2026!');
        const professor = await login('professor@projetoaprendiz.local', 'Professor@2026!');
        const all = await call(manager, '/alunos?limit=50');
        assert.equal(all.status, 200);
        assert.ok(all.data.alunos.length > 1);
        const student = all.data.alunos.find(item => item.igreja_id && item.classe && item.turmas.length);
        assert.ok(student);
        const params = new URLSearchParams({ church_id: student.igreja_id, classe: student.classe, curso: student.turmas[0].nome, turma_id: student.turmas[0].id });
        const expected = all.data.alunos.filter(item => item.igreja_id === student.igreja_id && item.classe === student.classe && item.turmas.some(turma => turma.id === student.turmas[0].id));
        const filtered = await call(manager, `/alunos?${params}&limit=1`);
        assert.equal(filtered.status, 200, JSON.stringify(filtered.data));
        assert.equal(filtered.data.total, expected.length);
        assert.equal(filtered.data.alunos.length, 1);
        const secondPage = await call(manager, `/alunos?${params}&limit=1&page=2`);
        assert.equal(secondPage.data.total, expected.length);
        assert.equal(secondPage.data.alunos.length, expected.length > 1 ? 1 : 0);
        for (const search of [student.nome, student.email, student.telefone].filter(Boolean)) {
            const result = await call(manager, `/alunos?search=${encodeURIComponent(search)}`);
            assert.equal(result.status, 200);
            assert.ok(result.data.alunos.some(item => item.id === student.id));
        }
        assert.equal((await call(manager, '/alunos?curso=inexistente')).data.total, 0);
        assert.equal((await call(manager, '/alunos?church_id=1%20OR%201=1')).status, 400);
        assert.equal((await call(manager, '/alunos?turma_id=abc')).status, 400);
        assert.equal((await call(manager, '/alunos?page=NaN&limit=NaN')).status, 200);
        const dashboard = await call(manager, '/api/dashboard/gestor');
        assert.ok(dashboard.data.ultimasInscricoes.every(item => Number(item.id) > 0));
        const detail = await call(manager, `/alunos/${student.id}`);
        assert.equal(detail.status, 200);
        assert.deepEqual(detail.data, student);
        assert.equal(Object.hasOwn(detail.data, 'frequencia'), false);
        assert.equal((await call('', `/alunos/${student.id}`)).status, 401);
        assert.equal((await call(professor, `/alunos/${student.id}`)).status, 403);
        assert.equal((await call(manager, '/alunos/999999')).status, 404);
        database = new DatabaseSync(databasePath);
        database.prepare('UPDATE students SET active=0 WHERE id=?').run(student.id);
        assert.equal((await call(manager, `/alunos/${student.id}`)).status, 404);
    } finally {
        database?.close();
        if (server.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
        await rm(directory, { recursive: true, force: true });
    }
});
