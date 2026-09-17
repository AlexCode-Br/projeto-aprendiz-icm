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
        const teacherList = await call(professor, '/professores/meus-alunos?limit=50');
        assert.equal(teacherList.status, 200, JSON.stringify(teacherList.data));
        const teacherStudent = teacherList.data.alunos.find(item => item.igreja_id && item.classe && item.turmas.length);
        assert.ok(teacherStudent);
        const turma = teacherStudent.turmas[0];
        const teacherFilters = new URLSearchParams({ curso: turma.nome, turma_id: turma.id, church_id: teacherStudent.igreja_id, classe: teacherStudent.classe });
        const expectedTeacherStudents = teacherList.data.alunos.filter(item => item.igreja_id === teacherStudent.igreja_id && item.classe === teacherStudent.classe && item.turmas.some(value => value.id === turma.id));
        const teacherFiltered = await call(professor, `/professores/meus-alunos?${teacherFilters}&limit=1`);
        assert.equal(teacherFiltered.data.total, expectedTeacherStudents.length);
        assert.equal(teacherFiltered.data.alunos.length, 1);
        assert.equal((await call(professor, `/professores/meus-alunos?${teacherFilters}&limit=1&page=2`)).data.alunos.length, expectedTeacherStudents.length > 1 ? 1 : 0);
        assert.equal((await call(professor, '/professores/meus-alunos?turma_id=abc')).status, 400);
        assert.equal((await call(professor, '/professores/meus-alunos?curso=inexistente')).data.total, 0);
        const owner = database.prepare('SELECT professor_profiles.user_id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE classes.id=?').get(turma.id);
        database.prepare('DELETE FROM attendance_records WHERE student_id=?').run(teacherStudent.id);
        const withoutCalls = await call(professor, `/professores/meus-alunos?search=${encodeURIComponent(teacherStudent.nome)}`);
        assert.equal(withoutCalls.data.alunos.find(item => item.id === teacherStudent.id).frequencia, null);
        for (const [index, status] of ['presente', 'ausente', 'justificado'].entries()) {
            const date = `2026-02-${20 + index}`;
            database.prepare('INSERT OR IGNORE INTO attendance_sessions (class_id,class_date,recorded_by) VALUES (?,?,?)').run(turma.id, date, owner.user_id);
            const sessionId = database.prepare('SELECT id FROM attendance_sessions WHERE class_id=? AND class_date=?').get(turma.id, date).id;
            database.prepare('INSERT INTO attendance_records (session_id,student_id,status) VALUES (?,?,?)').run(sessionId, teacherStudent.id, status);
        }
        const attendanceResult = await call(professor, `/api/professores/me/alunos?turma_id=${turma.id}&search=${encodeURIComponent(teacherStudent.nome)}`);
        assert.equal(attendanceResult.data.alunos.find(item => item.id === teacherStudent.id).frequencia, 67);
        const otherUser = database.prepare("INSERT INTO users (name,email,password_hash,role) VALUES ('Outro professor','outro-directory@example.com','unused','professor')").run().lastInsertRowid;
        const otherProfile = database.prepare("INSERT INTO professor_profiles (user_id,name,email) VALUES (?,'Outro professor','outro-directory@example.com')").run(otherUser).lastInsertRowid;
        database.prepare('INSERT INTO classes (school_year_id,course_id,professor_id,location_id,label) SELECT school_year_id,course_id,?,location_id,? FROM classes WHERE id=?').run(otherProfile, 'Turma privada', turma.id);
        const otherClass = database.prepare('SELECT classes.id,professor_profiles.user_id FROM classes JOIN professor_profiles ON professor_profiles.id=classes.professor_id WHERE professor_profiles.user_id=? LIMIT 1').get(otherUser);
        assert.ok(otherClass);
        database.prepare('INSERT OR IGNORE INTO attendance_sessions (class_id,class_date,recorded_by) VALUES (?,?,?)').run(otherClass.id, '2026-02-25', otherClass.user_id);
        const otherSession = database.prepare('SELECT id FROM attendance_sessions WHERE class_id=? AND class_date=?').get(otherClass.id, '2026-02-25');
        database.prepare('INSERT INTO attendance_records (session_id,student_id,status) VALUES (?,?,?)').run(otherSession.id, teacherStudent.id, 'ausente');
        const scoped = await call(professor, `/professores/meus-alunos?search=${encodeURIComponent(teacherStudent.nome)}`);
        assert.equal(scoped.data.alunos.find(item => item.id === teacherStudent.id).frequencia, 67);
        assert.ok(scoped.data.filtros.turmas.every(item => item.id !== otherClass.id));
        assert.equal((await call(professor, `/professores/meus-alunos?turma_id=${otherClass.id}`)).data.total, 0);
        assert.equal(Object.hasOwn((await call(manager, `/alunos/${teacherStudent.id}`)).data, 'frequencia'), false);
        database.prepare('UPDATE students SET active=0 WHERE id=?').run(student.id);
        assert.equal((await call(manager, `/alunos/${student.id}`)).status, 404);
    } finally {
        database?.close();
        if (server.exitCode === null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
        await rm(directory, { recursive: true, force: true });
    }
});
