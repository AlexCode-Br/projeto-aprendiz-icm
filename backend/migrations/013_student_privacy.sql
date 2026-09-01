ALTER TABLE students
  ADD COLUMN IF NOT EXISTS guardian_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS students_anonymized_at_idx ON students(anonymized_at);
