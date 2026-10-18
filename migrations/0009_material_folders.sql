ALTER TABLE materials ADD COLUMN managed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE materials ADD COLUMN candidates TEXT NOT NULL DEFAULT '[]';
CREATE TABLE material_files (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  material_id TEXT REFERENCES materials(id) ON DELETE SET NULL,
  file_hash TEXT NOT NULL DEFAULT '',
  checked_at INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'unreadable' CHECK(state IN ('available','missing','unreadable')),
  PRIMARY KEY(user_id,source_id,relative_path)
);
CREATE INDEX material_files_material ON material_files(material_id,state);
