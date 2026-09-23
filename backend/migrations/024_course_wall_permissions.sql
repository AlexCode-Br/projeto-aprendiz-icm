ALTER TABLE class_presentation
  ADD COLUMN stream_mode TEXT NOT NULL DEFAULT 'post_and_comment'
  CHECK (stream_mode IN ('post_and_comment','comment_only','teacher_only'));
