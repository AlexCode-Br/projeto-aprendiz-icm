CREATE TABLE class_schedule_dates (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  start_minutes SMALLINT NOT NULL CHECK(start_minutes BETWEEN 0 AND 1439),
  PRIMARY KEY(class_id, class_date, start_minutes)
);
REVOKE ALL ON class_schedule_dates FROM PUBLIC, anon, authenticated;
ALTER TABLE class_schedule_dates ENABLE ROW LEVEL SECURITY;
