-- "EAD" is the single canonical label for classes offered online.
DO $migration$
DECLARE
  remote_location_id INTEGER;
  ead_location_id INTEGER;
BEGIN
  SELECT id INTO remote_location_id
  FROM locations
  WHERE LOWER(BTRIM(name))='remoto'
  ORDER BY id
  LIMIT 1;

  IF remote_location_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO ead_location_id
  FROM locations
  WHERE LOWER(BTRIM(name))='ead'
    AND id<>remote_location_id
  ORDER BY id
  LIMIT 1;

  IF ead_location_id IS NULL THEN
    UPDATE locations SET name='EAD',active=1 WHERE id=remote_location_id;
    UPDATE classes
    SET label=REGEXP_REPLACE(label,'remoto','EAD','gi')
    WHERE location_id=remote_location_id AND label IS NOT NULL;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM classes AS remote_class
    JOIN classes AS ead_class
      ON ead_class.school_year_id=remote_class.school_year_id
     AND ead_class.course_id=remote_class.course_id
     AND ead_class.professor_id=remote_class.professor_id
     AND LOWER(COALESCE(ead_class.label,''))=LOWER(COALESCE(REGEXP_REPLACE(remote_class.label,'remoto','EAD','gi'),''))
     AND COALESCE(ead_class.weekday,'')=COALESCE(remote_class.weekday,'')
     AND COALESCE(ead_class.start_time::TEXT,'')=COALESCE(remote_class.start_time::TEXT,'')
    WHERE remote_class.location_id=remote_location_id
      AND ead_class.location_id=ead_location_id
  ) THEN
    RAISE EXCEPTION 'Não foi possível consolidar Remoto em EAD: existem turmas duplicadas.';
  END IF;

  UPDATE classes
  SET location_id=ead_location_id,
      label=CASE WHEN label IS NULL THEN NULL ELSE REGEXP_REPLACE(label,'remoto','EAD','gi') END
  WHERE location_id=remote_location_id;
  UPDATE professor_profiles SET home_location_id=ead_location_id WHERE home_location_id=remote_location_id;
  DELETE FROM locations WHERE id=remote_location_id;
  UPDATE locations SET name='EAD',active=1 WHERE id=ead_location_id;
END
$migration$;
