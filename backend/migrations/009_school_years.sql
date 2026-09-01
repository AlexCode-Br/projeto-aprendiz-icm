-- Períodos letivos podem atravessar anos civis. As datas abaixo são sentinelas
-- explícitas para o legado e devem ser confirmadas pelo Gestor em Configurações.
CREATE TABLE IF NOT EXISTS school_years (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK(active IN (0,1)),
  dates_confirmed INTEGER NOT NULL DEFAULT 1 CHECK(dates_confirmed IN (0,1)),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(start_date < end_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS school_years_label_lower_unique
  ON school_years (LOWER(label));
CREATE UNIQUE INDEX IF NOT EXISTS school_years_single_active_unique
  ON school_years (active) WHERE active = 1;

INSERT INTO school_years (label,start_date,end_date,active,dates_confirmed)
SELECT 'Período atual — datas pendentes',DATE '1900-01-01',DATE '1900-01-02',1,0
WHERE NOT EXISTS (SELECT 1 FROM school_years);

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS school_year_id INTEGER REFERENCES school_years(id);

UPDATE classes
SET school_year_id = (SELECT id FROM school_years WHERE active=1 LIMIT 1)
WHERE school_year_id IS NULL;

ALTER TABLE classes
  ALTER COLUMN school_year_id SET NOT NULL;

ALTER TABLE classes
  DROP CONSTRAINT IF EXISTS classes_course_id_professor_id_location_id_key;

CREATE INDEX IF NOT EXISTS classes_school_year_id_idx ON classes(school_year_id);
CREATE UNIQUE INDEX IF NOT EXISTS classes_period_offering_unique
  ON classes(school_year_id,course_id,professor_id,location_id);

ALTER TABLE school_years ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE school_years FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE school_years_id_seq FROM PUBLIC, anon, authenticated;
