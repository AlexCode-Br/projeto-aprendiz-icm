import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('gestor adiciona e anonimiza vários alunos com uma única ação segura', { timeout: 40000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aprendiz-student-bulk-'));
    const port = 59500 + (process.pid % 500);
    const baseUrl = `http://127.0.0.1:${port}`;
    let logs = '';
    const server = spawn(process.execPath, ['backend/server.mjs'], {
        cwd: join(import.meta.dirname, '..'),
        env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_URL: baseUrl, DATABASE_URL: '', SQLITE_PATH: join(directory, 'bulk.db'), AUTH_PROVIDER: 'local', SEED_DEMO_DATA: 'true', NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', chunk => { logs += chunk; });
    server.stderr.on('data', chunk => { logs += chunk; });

    const call = async (session, method, path, body) => {
        const headers = {};
        if (session?.cookie) headers.Cookie = session.cookie;
        if (session?.csrf) headers['X-CSRF-Token'] = session.csrf;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const response = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, data: await response.json(), headers: response.headers };
    };
    const login = async (email, password) => {
        const result = await call(null, 'POST', '/api/auth/login', { email, password });
        assert.equal(result.status, 200, JSON.stringify(result.data));
        return { cookie: String(result.headers.get('set-cookie')).split(';')[0], csrf: result.data.csrfToken };
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
        const directoryResult = await call(manager, 'GET', '/alunos?limit=50');
        const classesResult = await call(manager, 'GET', '/cursos');
        assert.equal(directoryResult.status, 200);
        assert.equal(classesResult.status, 200);
        const students = directoryResult.data.alunos.slice(0, 2);
        const targetClass = classesResult.data.cursos.find(item => students.every(student => !student.turmas.some(turma => turma.id === item.id)));
        assert.equal(students.length, 2);
        assert.ok(targetClass);
        const studentIds = students.map(student => student.id);

        const forbidden = await call(professor, 'POST', '/api/alunos/bulk/enroll', { student_ids: studentIds, class_id: targetClass.id });
        assert.equal(forbidden.status, 403);
        const invalid = await call(manager, 'POST', '/api/alunos/bulk/enroll', { student_ids: [studentIds[0], 'inválido'], class_id: targetClass.id });
        assert.equal(invalid.status, 400);

        const enrolled = await call(manager, 'POST', '/api/alunos/bulk/enroll', { student_ids: studentIds, class_id: targetClass.id });
        assert.equal(enrolled.status, 200, JSON.stringify(enrolled.data));
        assert.equal(enrolled.data.selected, 2);
        for (const studentId of studentIds) {
            const detail = await call(manager, 'GET', `/alunos/${studentId}`);
            assert.ok(detail.data.turmas.some(turma => turma.id === targetClass.id));
        }

        const anonymized = await call(manager, 'POST', '/api/alunos/bulk/anonymize', { student_ids: studentIds });
        assert.equal(anonymized.status, 200, JSON.stringify(anonymized.data));
        assert.equal(anonymized.data.anonymized, 2);
        for (const studentId of studentIds) assert.equal((await call(manager, 'GET', `/alunos/${studentId}`)).status, 404);
        const repeated = await call(manager, 'POST', '/api/alunos/bulk/anonymize', { student_ids: studentIds });
        assert.equal(repeated.status, 409);
    } finally {
        if (server.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
        await rm(directory, { recursive: true, force: true });
    }
});
