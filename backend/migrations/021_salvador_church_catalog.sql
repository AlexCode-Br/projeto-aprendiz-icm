-- "ICM" identifica a denominação, não o nome do local. Consolide cadastros
-- antigos antes de expor o diretório canônico, preservando todos os vínculos.
WITH normalized AS (
  SELECT id,
    BTRIM(REGEXP_REPLACE(name,'^ICM([[:space:]]+|-)+','','i')) AS normalized_name,
    CASE WHEN name ~* '^ICM([[:space:]]+|-)+' THEN 1 ELSE 0 END AS prefixed
  FROM churches
), mapped AS (
  SELECT id,FIRST_VALUE(id) OVER (
    PARTITION BY LOWER(normalized_name) ORDER BY prefixed,id
  ) AS target_id
  FROM normalized WHERE normalized_name<>''
)
UPDATE students SET church_id=mapped.target_id
FROM mapped
WHERE students.church_id=mapped.id AND mapped.id<>mapped.target_id;

WITH normalized AS (
  SELECT id,
    BTRIM(REGEXP_REPLACE(name,'^ICM([[:space:]]+|-)+','','i')) AS normalized_name,
    CASE WHEN name ~* '^ICM([[:space:]]+|-)+' THEN 1 ELSE 0 END AS prefixed
  FROM churches
), mapped AS (
  SELECT id,FIRST_VALUE(id) OVER (
    PARTITION BY LOWER(normalized_name) ORDER BY prefixed,id
  ) AS target_id
  FROM normalized WHERE normalized_name<>''
)
DELETE FROM churches USING mapped
WHERE churches.id=mapped.id AND mapped.id<>mapped.target_id;

UPDATE churches
SET name=BTRIM(REGEXP_REPLACE(name,'^ICM([[:space:]]+|-)+','','i'))
WHERE name ~* '^ICM([[:space:]]+|-)+';

WITH normalized AS (
  SELECT id,
    BTRIM(REGEXP_REPLACE(name,'^ICM([[:space:]]+|-)+','','i')) AS normalized_name,
    CASE WHEN name ~* '^ICM([[:space:]]+|-)+' THEN 1 ELSE 0 END AS prefixed
  FROM locations
), mapped AS (
  SELECT id,FIRST_VALUE(id) OVER (
    PARTITION BY LOWER(normalized_name) ORDER BY prefixed,id
  ) AS target_id
  FROM normalized WHERE normalized_name<>''
)
UPDATE classes SET location_id=mapped.target_id
FROM mapped
WHERE classes.location_id=mapped.id AND mapped.id<>mapped.target_id;

WITH normalized AS (
  SELECT id,
    BTRIM(REGEXP_REPLACE(name,'^ICM([[:space:]]+|-)+','','i')) AS normalized_name,
    CASE WHEN name ~* '^ICM([[:space:]]+|-)+' THEN 1 ELSE 0 END AS prefixed
  FROM locations
), mapped AS (
  SELECT id,FIRST_VALUE(id) OVER (
    PARTITION BY LOWER(normalized_name) ORDER BY prefixed,id
  ) AS target_id
  FROM normalized WHERE normalized_name<>''
)
UPDATE professor_profiles SET home_location_id=mapped.target_id
FROM mapped
WHERE professor_profiles.home_location_id=mapped.id AND mapped.id<>mapped.target_id;

WITH normalized AS (
  SELECT id,
    BTRIM(REGEXP_REPLACE(name,'^ICM([[:space:]]+|-)+','','i')) AS normalized_name,
    CASE WHEN name ~* '^ICM([[:space:]]+|-)+' THEN 1 ELSE 0 END AS prefixed
  FROM locations
), mapped AS (
  SELECT id,FIRST_VALUE(id) OVER (
    PARTITION BY LOWER(normalized_name) ORDER BY prefixed,id
  ) AS target_id
  FROM normalized WHERE normalized_name<>''
)
DELETE FROM locations USING mapped
WHERE locations.id=mapped.id AND mapped.id<>mapped.target_id;

UPDATE locations
SET name=BTRIM(REGEXP_REPLACE(name,'^ICM([[:space:]]+|-)+','','i'))
WHERE name ~* '^ICM([[:space:]]+|-)+';

WITH catalog(name) AS (VALUES
  ('Alto da Terezinha'),
  ('Alto de Coutos'),
  ('Bairro Novo'),
  ('Boca do Rio'),
  ('Brotas'),
  ('Campinas de Pirajá'),
  ('Cidade Baixa'),
  ('Cidade Nova'),
  ('Fazenda Coutos'),
  ('Fazenda Grande'),
  ('Garcia'),
  ('Guarani'),
  ('IAPI'),
  ('Itaigara'),
  ('Itapuã I'),
  ('Itapuã II'),
  ('Itapuã III'),
  ('Jardim Terra Nova'),
  ('Jardim Valéria'),
  ('Lobato'),
  ('Luiz Anselmo'),
  ('Mirantes de Periperi'),
  ('Pero Vaz'),
  ('Pituba'),
  ('São Cristóvão'),
  ('São Marcos'),
  ('Vista Alegre')
)
INSERT INTO locations (name,active)
SELECT catalog.name,1
FROM catalog
WHERE NOT EXISTS (
  SELECT 1 FROM locations
  WHERE LOWER(locations.name)=LOWER(catalog.name)
)
ON CONFLICT DO NOTHING;

WITH catalog(name) AS (VALUES
  ('Alto da Terezinha'),
  ('Alto de Coutos'),
  ('Bairro Novo'),
  ('Boca do Rio'),
  ('Brotas'),
  ('Campinas de Pirajá'),
  ('Cidade Baixa'),
  ('Cidade Nova'),
  ('Fazenda Coutos'),
  ('Fazenda Grande'),
  ('Garcia'),
  ('Guarani'),
  ('IAPI'),
  ('Itaigara'),
  ('Itapuã I'),
  ('Itapuã II'),
  ('Itapuã III'),
  ('Jardim Terra Nova'),
  ('Jardim Valéria'),
  ('Lobato'),
  ('Luiz Anselmo'),
  ('Mirantes de Periperi'),
  ('Pero Vaz'),
  ('Pituba'),
  ('São Cristóvão'),
  ('São Marcos'),
  ('Vista Alegre')
)
UPDATE locations
SET active=1
FROM catalog
WHERE LOWER(locations.name)=LOWER(catalog.name)
  AND locations.active<>1;
