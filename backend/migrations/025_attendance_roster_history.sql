-- Preserve the end of legacy non-active enrollments so historical attendance
-- can evaluate membership by date. Existing calls remain authoritative through
-- their attendance_records snapshot.
UPDATE enrollments
SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
WHERE status <> 'ativa';

CREATE INDEX IF NOT EXISTS enrollments_class_status_student_idx
  ON enrollments(class_id,status,student_id);

CREATE INDEX IF NOT EXISTS enrollments_class_period_idx
  ON enrollments(class_id,enrolled_at,completed_at,student_id);
