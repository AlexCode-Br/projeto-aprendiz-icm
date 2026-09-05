-- Repair artifacts left behind when the historical lifecycle migration was
-- deployed and later removed from the repository. The application migration
-- runner wraps this file in a transaction, so copied data and dropped legacy
-- objects are committed atomically.

-- Contacts must outlive the user that registered them. This also allows a
-- migrated follow-up authored by a professor to survive professor deletion.
DO $migration$
DECLARE
  contact_user_attnum SMALLINT;
  contact_user_fk RECORD;
  contact_user_fk_count INTEGER;
  contact_user_fk_is_set_null BOOLEAN;
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'student_contacts')) IS NOT NULL
     AND to_regclass(format('%I.%I', current_schema(), 'users')) IS NOT NULL THEN
    SELECT attnum
      INTO contact_user_attnum
    FROM pg_attribute
    WHERE attrelid = 'student_contacts'::regclass
      AND attname = 'user_id'
      AND NOT attisdropped;

    IF contact_user_attnum IS NOT NULL THEN
      EXECUTE 'ALTER TABLE student_contacts ALTER COLUMN user_id DROP NOT NULL';

      SELECT COUNT(*), COALESCE(BOOL_AND(confdeltype = 'n'), FALSE)
        INTO contact_user_fk_count, contact_user_fk_is_set_null
      FROM pg_constraint
      WHERE conrelid = 'student_contacts'::regclass
        AND confrelid = 'users'::regclass
        AND contype = 'f'
        AND conkey = ARRAY[contact_user_attnum]::SMALLINT[];

      IF contact_user_fk_count <> 1 OR NOT contact_user_fk_is_set_null THEN
        FOR contact_user_fk IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'student_contacts'::regclass
            AND confrelid = 'users'::regclass
            AND contype = 'f'
            AND conkey = ARRAY[contact_user_attnum]::SMALLINT[]
        LOOP
          EXECUTE format(
            'ALTER TABLE student_contacts DROP CONSTRAINT %I',
            contact_user_fk.conname
          );
        END LOOP;

        EXECUTE $sql$
          ALTER TABLE student_contacts
            ADD CONSTRAINT student_contacts_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        $sql$;
      END IF;

      EXECUTE $sql$
        CREATE INDEX IF NOT EXISTS student_contacts_user_id_idx
          ON student_contacts(user_id)
      $sql$;
    END IF;
  END IF;
END
$migration$;

-- Preserve every historical intervention in the current contact timeline.
-- student_contacts has no class column, so the class and all free-text legacy
-- fields are retained in the note before the blocking table is removed.
DO $migration$
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'student_followups')) IS NOT NULL THEN
    IF to_regclass(format('%I.%I', current_schema(), 'student_contacts')) IS NULL THEN
      RAISE EXCEPTION
        'student_contacts is required before migrating student_followups';
    END IF;

    EXECUTE $sql$
      INSERT INTO student_contacts (student_id,user_id,note,outcome,contacted_at)
      SELECT
        followup.student_id,
        followup.created_by,
        CONCAT_WS(
          E'\n',
          '[Acompanhamento legado]',
          'Turma original: #' || followup.class_id::TEXT ||
            COALESCE(' — ' || NULLIF(BTRIM(class_row.label), ''), ''),
          'Motivo: ' || BTRIM(followup.reason),
          CASE
            WHEN NULLIF(BTRIM(followup.contact_type), '') IS NOT NULL
              THEN 'Tipo de contato: ' || BTRIM(followup.contact_type)
          END,
          CASE
            WHEN NULLIF(BTRIM(followup.outcome), '') IS NOT NULL
              THEN 'Resultado original: ' || BTRIM(followup.outcome)
          END,
          CASE
            WHEN NULLIF(BTRIM(followup.notes), '') IS NOT NULL
              THEN 'Observações: ' || BTRIM(followup.notes)
          END
        ),
        CASE
          WHEN LOWER(BTRIM(COALESCE(followup.outcome, ''))) = 'contatado'
            THEN 'contatado'
          WHEN LOWER(BTRIM(COALESCE(followup.outcome, ''))) IN
               ('sem resposta', 'sem_resposta', 'não respondeu', 'nao respondeu')
            THEN 'sem_resposta'
          WHEN LOWER(BTRIM(COALESCE(followup.outcome, ''))) IN
               ('retorno agendado', 'retorno_agendado')
            THEN 'retorno_agendado'
          ELSE 'outro'
        END,
        followup.created_at
      FROM student_followups AS followup
      LEFT JOIN classes AS class_row ON class_row.id = followup.class_id
      ORDER BY followup.id
    $sql$;

    EXECUTE 'DROP TABLE student_followups';
  END IF;
END
$migration$;

-- The legacy students.location_id pointed at the teaching-location catalog.
-- Copy that relationship into the current church catalog without overwriting a
-- church already chosen in the current model, then remove the obsolete FK.
DO $migration$
DECLARE
  has_legacy_location BOOLEAN;
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'students')) IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = 'students'::regclass
        AND attname = 'location_id'
        AND NOT attisdropped
    ) INTO has_legacy_location;

    IF has_legacy_location THEN
      IF to_regclass(format('%I.%I', current_schema(), 'locations')) IS NULL
         OR to_regclass(format('%I.%I', current_schema(), 'churches')) IS NULL THEN
        RAISE EXCEPTION
          'locations and churches are required before removing students.location_id';
      END IF;

      EXECUTE $sql$
        INSERT INTO churches (name)
        SELECT DISTINCT BTRIM(location.name)
        FROM students AS student
        JOIN locations AS location ON location.id = student.location_id
        WHERE BTRIM(location.name) <> ''
        ON CONFLICT DO NOTHING
      $sql$;

      EXECUTE $sql$
        UPDATE students AS student
        SET church_id = church.id
        FROM locations AS location
        JOIN churches AS church
          ON LOWER(BTRIM(church.name)) = LOWER(BTRIM(location.name))
        WHERE student.location_id = location.id
          AND student.church_id IS NULL
      $sql$;

      EXECUTE 'ALTER TABLE students DROP COLUMN location_id';
    END IF;
  END IF;
END
$migration$;

-- The reverted migration dropped the enrollment identity constraint. Keep the
-- most relevant row (active first, then the newest) for each accidental
-- duplicate before restoring the invariant expected by INSERT ... ON CONFLICT.
-- The discarded physical rows are archived as JSONB so no historical payload
-- is irreversibly lost and can be recovered during a manual audit.
CREATE TABLE IF NOT EXISTS enrollment_repair_archive (
  original_enrollment_id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON enrollment_repair_archive FROM PUBLIC;
DO $migration$
DECLARE application_role RECORD;
BEGIN
  FOR application_role IN
    SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')
  LOOP
    EXECUTE format('REVOKE ALL ON enrollment_repair_archive FROM %I', application_role.rolname);
  END LOOP;
END
$migration$;
ALTER TABLE enrollment_repair_archive ENABLE ROW LEVEL SECURITY;

DO $migration$
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'enrollments')) IS NOT NULL THEN
    EXECUTE $sql$
      WITH duplicate_enrollments AS (
        SELECT enrollment.*,
          ROW_NUMBER() OVER (
            PARTITION BY student_id,class_id
            ORDER BY
              CASE status
                WHEN 'ativa' THEN 0
                WHEN 'concluida' THEN 1
                ELSE 2
              END,
              enrolled_at DESC,
              id DESC
          ) AS duplicate_rank
        FROM enrollments AS enrollment
      )
      INSERT INTO enrollment_repair_archive
        (original_enrollment_id,student_id,class_id,snapshot)
      SELECT id,student_id,class_id,to_jsonb(duplicate_enrollments) - 'duplicate_rank'
      FROM duplicate_enrollments
      WHERE duplicate_rank > 1
      ON CONFLICT (original_enrollment_id) DO NOTHING
    $sql$;

    EXECUTE $sql$
      WITH duplicate_enrollments AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY student_id,class_id
            ORDER BY
              CASE status
                WHEN 'ativa' THEN 0
                WHEN 'concluida' THEN 1
                ELSE 2
              END,
              enrolled_at DESC,
              id DESC
          ) AS duplicate_rank
        FROM enrollments
      )
      DELETE FROM enrollments AS enrollment
      USING duplicate_enrollments AS duplicate
      WHERE enrollment.id = duplicate.id
        AND duplicate.duplicate_rank > 1
    $sql$;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'enrollments'::regclass
        AND conname = 'enrollments_student_id_class_id_key'
        AND contype = 'u'
    ) THEN
      EXECUTE $sql$
        ALTER TABLE enrollments
          ADD CONSTRAINT enrollments_student_id_class_id_key
          UNIQUE (student_id,class_id)
      $sql$;
    END IF;
  END IF;
END
$migration$;

-- PostgreSQL does not create an index on the referencing side of a foreign key.
-- Catalog deletion and the many class/course joins need this leading index.
CREATE INDEX IF NOT EXISTS classes_course_id_idx ON classes(course_id);

-- announcement_recipients is intentionally untouched: zero recipient rows is
-- the representation for an announcement addressed to the full audience.
