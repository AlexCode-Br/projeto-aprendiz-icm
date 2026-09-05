import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';

const migrationPath = join(import.meta.dirname, 'migrations', '016_repair_legacy_lifecycle_drift.sql');
const migrationSql = await readFile(migrationPath, 'utf8');
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('migração de reparo mantém a semântica de destinatário global', () => {
  const executableSql = migrationSql.replace(/--.*$/gm, '');
  assert.doesNotMatch(executableSql, /announcement_recipients/i);
  assert.match(executableSql, /DROP TABLE student_followups/i);
  assert.match(executableSql, /DROP COLUMN location_id/i);
  assert.match(executableSql, /UNIQUE \(student_id,class_id\)/i);
  assert.match(executableSql, /classes_course_id_idx/i);
});

test('migração PostgreSQL repara o drift sem perder dados úteis', {
  skip: !testDatabaseUrl && 'defina TEST_DATABASE_URL para executar a regressão PostgreSQL',
  timeout: 30_000,
}, async () => {
  const client = new pg.Client({ connectionString: testDatabaseUrl });
  const schema = `legacy_drift_${process.pid}_${randomBytes(6).toString('hex')}`;
  assert.match(schema, /^[a-z0-9_]+$/);
  const quotedSchema = `"${schema}"`;

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${quotedSchema}`);
    await client.query(`SET LOCAL search_path TO ${quotedSchema}`);
    await client.query(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE locations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE churches (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE UNIQUE INDEX churches_name_lower_unique ON churches(LOWER(name));
      CREATE TABLE courses (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE professor_profiles (
        id INTEGER PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        home_location_id INTEGER REFERENCES locations(id)
      );
      CREATE TABLE classes (
        id INTEGER PRIMARY KEY,
        course_id INTEGER NOT NULL REFERENCES courses(id),
        professor_id INTEGER NOT NULL REFERENCES professor_profiles(id),
        location_id INTEGER NOT NULL REFERENCES locations(id),
        label TEXT
      );
      CREATE TABLE students (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        church_id INTEGER REFERENCES churches(id),
        location_id INTEGER REFERENCES locations(id)
      );
      CREATE INDEX students_location_id_idx ON students(location_id);
      CREATE TABLE enrollments (
        id INTEGER PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id),
        class_id INTEGER NOT NULL REFERENCES classes(id),
        status TEXT NOT NULL,
        enrolled_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        transferred_to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL
      );
      CREATE TABLE student_contacts (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        note TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK(outcome IN ('contatado','sem_resposta','retorno_agendado','outro')),
        contacted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX student_contacts_user_id_idx ON student_contacts(user_id);
      CREATE TABLE student_followups (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES classes(id),
        reason TEXT NOT NULL,
        contact_type TEXT,
        outcome TEXT,
        notes TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE announcement_recipients (
        id INTEGER PRIMARY KEY
      );

      INSERT INTO users (id,name) VALUES (1,'Gestora'),(2,'Professor legado');
      INSERT INTO locations (id,name) VALUES (1,'Igreja da Colina');
      INSERT INTO churches (id,name) VALUES (10,'Igreja já escolhida');
      INSERT INTO courses (id,name) VALUES (1,'Curso legado');
      INSERT INTO professor_profiles (id,user_id,home_location_id) VALUES (1,2,1);
      INSERT INTO classes (id,course_id,professor_id,location_id,label)
        VALUES (1,1,1,1,'Turma histórica');
      INSERT INTO students (id,name,church_id,location_id)
        VALUES (1,'Aluno legado',NULL,1),(2,'Aluno atual',10,1);
      INSERT INTO enrollments (id,student_id,class_id,status,enrolled_at,completed_at)
        VALUES
          (1,1,1,'cancelada','2025-01-10T12:00:00Z','2025-06-10T12:00:00Z'),
          (2,1,1,'ativa','2026-01-10T12:00:00Z',NULL);
      INSERT INTO student_followups
        (student_id,class_id,reason,contact_type,outcome,notes,created_by,created_at)
        VALUES
          (1,1,'Duas faltas seguidas','Telefone','Sem resposta',
           'Tentar novamente na sexta-feira',2,'2026-02-03T15:00:00Z');
    `);

    await client.query(migrationSql);
    await client.query(migrationSql);

    const legacyArtifacts = await client.query(`
      SELECT
        to_regclass('student_followups') AS followups_table,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema=current_schema()
            AND table_name='students'
            AND column_name='location_id'
        ) AS has_student_location
    `);
    assert.equal(legacyArtifacts.rows[0].followups_table, null);
    assert.equal(legacyArtifacts.rows[0].has_student_location, false);

    const migratedContact = await client.query(`
      SELECT student_id,user_id,note,outcome,contacted_at
      FROM student_contacts
    `);
    assert.equal(migratedContact.rowCount, 1, 'executar a migração novamente não duplica contatos');
    assert.equal(migratedContact.rows[0].student_id, 1);
    assert.equal(migratedContact.rows[0].user_id, 2);
    assert.equal(migratedContact.rows[0].outcome, 'sem_resposta');
    assert.match(migratedContact.rows[0].note, /Turma original: #1 — Turma histórica/);
    assert.match(migratedContact.rows[0].note, /Duas faltas seguidas/);
    assert.match(migratedContact.rows[0].note, /Telefone/);
    assert.match(migratedContact.rows[0].note, /Tentar novamente na sexta-feira/);

    const churches = await client.query(`
      SELECT student.id,student.church_id,church.name
      FROM students AS student
      JOIN churches AS church ON church.id=student.church_id
      ORDER BY student.id
    `);
    assert.equal(churches.rowCount, 2);
    assert.equal(churches.rows[0].id, 1);
    assert.equal(churches.rows[0].name, 'Igreja da Colina');
    assert.ok(churches.rows[0].church_id);
    assert.deepEqual(churches.rows[1], { id: 2, church_id: 10, name: 'Igreja já escolhida' });

    const enrollments = await client.query(`
      SELECT id,status FROM enrollments WHERE student_id=1 AND class_id=1
    `);
    assert.deepEqual(enrollments.rows, [{ id: 2, status: 'ativa' }]);
    const archivedEnrollment = await client.query(`
      SELECT original_enrollment_id,student_id,class_id,snapshot->>'status' AS status
      FROM enrollment_repair_archive
    `);
    assert.deepEqual(archivedEnrollment.rows, [{ original_enrollment_id: 1, student_id: 1, class_id: 1, status: 'cancelada' }]);

    const enrollmentConstraint = await client.query(`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid='enrollments'::regclass
        AND conname='enrollments_student_id_class_id_key'
        AND contype='u'
    `);
    assert.equal(enrollmentConstraint.rowCount, 1);
    assert.match(enrollmentConstraint.rows[0].definition, /UNIQUE \(student_id, class_id\)/);

    await client.query('SAVEPOINT unique_enrollment_probe');
    let duplicateError;
    try {
      await client.query(`
        INSERT INTO enrollments (id,student_id,class_id,status,enrolled_at)
        VALUES (99,1,1,'ativa',CURRENT_TIMESTAMP)
      `);
    } catch (error) {
      duplicateError = error;
    }
    await client.query('ROLLBACK TO SAVEPOINT unique_enrollment_probe');
    await client.query('RELEASE SAVEPOINT unique_enrollment_probe');
    assert.equal(duplicateError?.code, '23505');

    const contactForeignKey = await client.query(`
      SELECT constraint_definition.confdeltype,column_definition.attnotnull
      FROM pg_constraint AS constraint_definition
      JOIN pg_attribute AS column_definition
        ON column_definition.attrelid=constraint_definition.conrelid
       AND column_definition.attnum=ANY(constraint_definition.conkey)
      WHERE constraint_definition.conrelid='student_contacts'::regclass
        AND constraint_definition.confrelid='users'::regclass
        AND constraint_definition.contype='f'
        AND column_definition.attname='user_id'
    `);
    assert.deepEqual(contactForeignKey.rows, [{ confdeltype: 'n', attnotnull: false }]);

    const courseIndex = await client.query(`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname=current_schema()
        AND tablename='classes'
        AND indexname='classes_course_id_idx'
    `);
    assert.equal(courseIndex.rowCount, 1);
    assert.match(courseIndex.rows[0].indexdef, /\(course_id\)$/);

    await client.query('DELETE FROM users WHERE id=2');
    assert.deepEqual(
      (await client.query('SELECT user_id,note FROM student_contacts')).rows,
      [{ user_id: null, note: migratedContact.rows[0].note }],
    );

    await client.query('DELETE FROM enrollments WHERE class_id=1');
    await client.query('DELETE FROM classes WHERE course_id=1');
    await client.query('DELETE FROM courses WHERE id=1');
    await client.query('UPDATE professor_profiles SET home_location_id=NULL WHERE home_location_id=1');
    await client.query('DELETE FROM locations WHERE id=1');
    assert.equal((await client.query('SELECT COUNT(*)::INTEGER AS total FROM courses')).rows[0].total, 0);
    assert.equal((await client.query('SELECT COUNT(*)::INTEGER AS total FROM locations')).rows[0].total, 0);
    assert.equal((await client.query('SELECT COUNT(*)::INTEGER AS total FROM announcement_recipients')).rows[0].total, 0);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
});
