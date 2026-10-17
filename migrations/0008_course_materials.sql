CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  pages TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id,course_id,content_hash)
);
CREATE INDEX materials_course ON materials(user_id,course_id);
