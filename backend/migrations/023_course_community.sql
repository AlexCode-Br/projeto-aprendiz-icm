CREATE TABLE IF NOT EXISTS projeto_aprendiz.class_presentation (
 class_id INTEGER PRIMARY KEY REFERENCES projeto_aprendiz.classes(id) ON DELETE CASCADE,
 address TEXT NOT NULL DEFAULT '', banner_data TEXT, banner_mime TEXT,
 banner_x INTEGER NOT NULL DEFAULT 50, banner_y INTEGER NOT NULL DEFAULT 50, banner_zoom INTEGER NOT NULL DEFAULT 100,
 configured_by INTEGER REFERENCES projeto_aprendiz.users(id) ON DELETE SET NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS class_presentation_owner_idx ON projeto_aprendiz.class_presentation(configured_by);
CREATE TABLE IF NOT EXISTS projeto_aprendiz.course_post_likes (
 announcement_id INTEGER NOT NULL REFERENCES projeto_aprendiz.announcements(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES projeto_aprendiz.users(id) ON DELETE CASCADE,
 PRIMARY KEY(announcement_id,user_id)
);
CREATE INDEX IF NOT EXISTS course_post_likes_user_idx ON projeto_aprendiz.course_post_likes(user_id);
CREATE TABLE IF NOT EXISTS projeto_aprendiz.course_post_comments (
 id TEXT PRIMARY KEY,
 announcement_id INTEGER NOT NULL REFERENCES projeto_aprendiz.announcements(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES projeto_aprendiz.users(id) ON DELETE CASCADE,
 content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 2000),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS course_post_comments_post_idx ON projeto_aprendiz.course_post_comments(announcement_id,created_at);
CREATE INDEX IF NOT EXISTS course_post_comments_user_idx ON projeto_aprendiz.course_post_comments(user_id);

ALTER TABLE projeto_aprendiz.class_presentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.course_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_aprendiz.course_post_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON projeto_aprendiz.class_presentation,projeto_aprendiz.course_post_likes,projeto_aprendiz.course_post_comments FROM PUBLIC,anon,authenticated;
