-- A migração é deliberadamente idempotente: a aplicação executa as migrações no
-- startup e uma implantação interrompida não pode deixar o banco indisponível.

-- 1. Alunos: mantém a igreja informada livremente e, quando houver equivalência,
-- também registra o vínculo com o catálogo de igrejas.
ALTER TABLE students ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
CREATE INDEX IF NOT EXISTS students_location_id_idx ON students(location_id);
UPDATE students AS student
SET location_id = location.id
FROM locations AS location
WHERE student.location_id IS NULL
  AND student.church IS NOT NULL
  AND LOWER(location.name) = LOWER(student.church);

-- 2. Turmas: o antigo UNIQUE impedia reutilizar uma combinação após o histórico.
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_course_id_professor_id_location_id_key;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS status TEXT;
UPDATE classes SET status = 'ativa' WHERE status IS NULL;
ALTER TABLE classes ALTER COLUMN status SET DEFAULT 'ativa';
ALTER TABLE classes ALTER COLUMN status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'classes'::regclass
      AND conname = 'classes_lifecycle_status_check'
  ) THEN
    ALTER TABLE classes
      ADD CONSTRAINT classes_lifecycle_status_check
      CHECK (status IN ('ativa', 'concluida', 'cancelada'));
  END IF;
END $$;

-- 3. Matrículas: preserva os períodos anteriores em vez de sobrescrever uma
-- matrícula finalizada. O backfill usa a data original de inscrição.
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_class_id_key;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
UPDATE enrollments SET started_at = enrolled_at WHERE started_at IS NULL;
ALTER TABLE enrollments ALTER COLUMN started_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE enrollments ALTER COLUMN started_at SET NOT NULL;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS end_reason TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- 4. Nova tabela Student Followups (Intervenções)
CREATE TABLE IF NOT EXISTS student_followups (
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
CREATE INDEX IF NOT EXISTS student_followups_student_id_idx ON student_followups(student_id);
CREATE INDEX IF NOT EXISTS student_followups_class_id_idx ON student_followups(class_id);
