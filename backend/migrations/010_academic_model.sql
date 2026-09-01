CREATE TABLE IF NOT EXISTS churches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS churches_name_lower_unique ON churches(LOWER(name));

INSERT INTO churches (name)
SELECT DISTINCT BTRIM(church)
FROM students
WHERE church IS NOT NULL AND BTRIM(church)<>''
ON CONFLICT DO NOTHING;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_phone TEXT,
  ADD COLUMN IF NOT EXISTS church_id INTEGER REFERENCES churches(id);

UPDATE students
SET church_id=churches.id
FROM churches
WHERE students.church_id IS NULL
  AND students.church IS NOT NULL
  AND LOWER(churches.name)=LOWER(BTRIM(students.church));

UPDATE students SET email=NULL WHERE email IS NOT NULL AND BTRIM(email)='';
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_email_key;
DROP INDEX IF EXISTS students_email_lower_unique;
ALTER TABLE students ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX students_email_lower_unique
  ON students(LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS students_church_id_idx ON students(church_id);
ALTER TABLE students DROP COLUMN IF EXISTS church;

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE classes
  DROP CONSTRAINT IF EXISTS classes_capacity_check;
ALTER TABLE classes
  ADD CONSTRAINT classes_capacity_check CHECK(capacity IS NULL OR (capacity BETWEEN 1 AND 500));
DROP INDEX IF EXISTS classes_period_offering_unique;
CREATE UNIQUE INDEX IF NOT EXISTS classes_distinct_offering_unique
  ON classes(
    school_year_id,
    course_id,
    professor_id,
    location_id,
    LOWER(COALESCE(label,'')),
    COALESCE(weekday,''),
    COALESCE(start_time::TEXT,'')
  );

ALTER TABLE dropout_events
  ADD COLUMN IF NOT EXISTS reason_category TEXT NOT NULL DEFAULT 'outro';
ALTER TABLE dropout_events
  DROP CONSTRAINT IF EXISTS dropout_events_reason_category_check;
ALTER TABLE dropout_events
  ADD CONSTRAINT dropout_events_reason_category_check
    CHECK(reason_category IN ('mudanca','desinteresse','horario','saude','familia','outro'));
UPDATE dropout_events SET reason_category=CASE
  WHEN LOWER(reason) LIKE '%horário%' OR LOWER(reason) LIKE '%horario%' THEN 'horario'
  WHEN LOWER(reason) LIKE '%família%' OR LOWER(reason) LIKE '%familia%' OR LOWER(reason) LIKE '%pessoais%' THEN 'familia'
  WHEN LOWER(reason) LIKE '%saúde%' OR LOWER(reason) LIKE '%saude%' THEN 'saude'
  WHEN LOWER(reason) LIKE '%mudança%' OR LOWER(reason) LIKE '%mudanca%' THEN 'mudanca'
  WHEN LOWER(reason) LIKE '%desinteresse%' THEN 'desinteresse'
  ELSE 'outro'
END;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transferred_to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS enrollments_transferred_to_class_id_idx ON enrollments(transferred_to_class_id);

ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE churches FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE churches_id_seq FROM PUBLIC, anon, authenticated;
