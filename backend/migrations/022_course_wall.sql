ALTER TABLE student_course_announcements
  ADD COLUMN requires_acknowledgement INTEGER NOT NULL DEFAULT 0
  CHECK (requires_acknowledgement IN (0,1));

CREATE INDEX student_course_announcements_class_ack_idx
  ON student_course_announcements(class_id,requires_acknowledgement,announcement_id);

