// SQLite schema for local initialization. PostgreSQL evolves through migrations.
export const communitySchema = `
CREATE TABLE IF NOT EXISTS class_presentation (
 class_id INTEGER PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
 address TEXT NOT NULL DEFAULT '', banner_data TEXT, banner_mime TEXT,
 banner_x INTEGER NOT NULL DEFAULT 50, banner_y INTEGER NOT NULL DEFAULT 50, banner_zoom INTEGER NOT NULL DEFAULT 100,
 stream_mode TEXT NOT NULL DEFAULT 'post_and_comment' CHECK(stream_mode IN ('post_and_comment','comment_only','teacher_only')),
 configured_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS class_presentation_owner_idx ON class_presentation(configured_by);
CREATE TABLE IF NOT EXISTS course_post_likes (
 announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 PRIMARY KEY(announcement_id,user_id)
);
CREATE INDEX IF NOT EXISTS course_post_likes_user_idx ON course_post_likes(user_id);
CREATE TABLE IF NOT EXISTS course_post_comments (
 id TEXT PRIMARY KEY,
 announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 2000),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS course_post_comments_post_idx ON course_post_comments(announcement_id,created_at);
CREATE INDEX IF NOT EXISTS course_post_comments_user_idx ON course_post_comments(user_id);
`;
