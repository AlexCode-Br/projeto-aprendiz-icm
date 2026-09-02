-- Private application schema. Minutes since midnight avoid time zone conversion
-- for recurring local class times and match the SQLite development adapter.
CREATE TABLE class_schedules (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  weekday_index SMALLINT NOT NULL CHECK(weekday_index BETWEEN 0 AND 6),
  start_minutes SMALLINT NOT NULL CHECK(start_minutes BETWEEN 0 AND 1439),
  PRIMARY KEY(class_id, weekday_index, start_minutes)
);

INSERT INTO class_schedules (class_id,weekday_index,start_minutes)
SELECT id,
  CASE weekday WHEN 'Segunda-feira' THEN 0 WHEN 'Terça-feira' THEN 1
    WHEN 'Quarta-feira' THEN 2 WHEN 'Quinta-feira' THEN 3
    WHEN 'Sexta-feira' THEN 4 WHEN 'Sábado' THEN 5 WHEN 'Domingo' THEN 6 END,
  SPLIT_PART(start_time,':',1)::SMALLINT * 60 + SPLIT_PART(start_time,':',2)::SMALLINT
FROM classes
WHERE weekday IN ('Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo')
  AND start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

REVOKE ALL ON class_schedules FROM PUBLIC, anon, authenticated;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
-- Access goes through the existing server and its ownership checks; no Data API policy.
