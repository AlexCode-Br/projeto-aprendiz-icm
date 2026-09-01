CREATE TABLE IF NOT EXISTS profile_photos (
  id SERIAL PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK(owner_type IN ('user','professor','student')),
  owner_id INTEGER NOT NULL CHECK(owner_id > 0),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0 AND size_bytes <= 5242880),
  data_url TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_type, owner_id),
  CHECK((data_url IS NOT NULL AND storage_path IS NULL) OR (data_url IS NULL AND storage_path IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS profile_photos_storage_path_unique ON profile_photos(storage_path) WHERE storage_path IS NOT NULL;
