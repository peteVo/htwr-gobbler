// Fixed account-scoped operations for the authenticated loopback runner.
export const localQueries = {
  courseName: "SELECT name FROM courses WHERE id=? AND user_id=?",
  connectSource:
    "INSERT INTO sources (id,user_id,name,kind) VALUES (?,?,?,'folder') ON CONFLICT(id) DO NOTHING",
  source: "SELECT id FROM sources WHERE id=? AND user_id=? AND kind='folder'",
  ownedCourse: "SELECT id FROM courses WHERE id=? AND user_id=?",
  attempt: "UPDATE sources SET last_attempt=? WHERE id=? AND user_id=?",
  unavailableFile:
    "UPDATE material_files SET state='unreadable' WHERE user_id=? AND source_id=? AND relative_path=?",
  file: "SELECT file_hash,state,material_id,checked_at FROM material_files WHERE user_id=? AND source_id=? AND relative_path=?",
  saveMaterial:
    "INSERT INTO materials (id,user_id,course_id,name,source_url,pages,content_hash,created_at,managed,candidates) SELECT ?,?,?,?,'',?,?,?,1,? WHERE (SELECT COUNT(*) FROM materials WHERE user_id=?)<100 AND (SELECT COALESCE(SUM(length(pages)),0) FROM materials WHERE user_id=?) + length(?5)<=5000000 ON CONFLICT(user_id,course_id,content_hash) DO NOTHING",
  material:
    "SELECT id FROM materials WHERE user_id=? AND course_id=? AND content_hash=?",
  bindFile:
    "INSERT INTO material_files (user_id,source_id,relative_path,material_id,file_hash,state) VALUES (?,?,?,?,?,'available') ON CONFLICT(user_id,source_id,relative_path) DO UPDATE SET material_id=excluded.material_id,file_hash=excluded.file_hash,state='available'",
  failedFile:
    "INSERT INTO material_files (user_id,source_id,relative_path,state,file_hash,checked_at) VALUES (?,?,?,'unreadable',?,?) ON CONFLICT(user_id,source_id,relative_path) DO UPDATE SET state='unreadable',file_hash=excluded.file_hash,checked_at=excluded.checked_at",
  files:
    "SELECT relative_path FROM material_files WHERE user_id=? AND source_id=?",
  missingFile:
    "UPDATE material_files SET state='missing' WHERE user_id=? AND source_id=? AND relative_path=?",
  unavailableFolder:
    "UPDATE material_files SET state='unreadable' WHERE user_id=? AND source_id=?",
  discardSuperseded:
    "DELETE FROM materials WHERE user_id=? AND managed=1 AND NOT EXISTS (SELECT 1 FROM material_files WHERE material_id=materials.id)",
  countFiles:
    "SELECT COUNT(*) AS n FROM material_files WHERE user_id=? AND source_id=? AND state='available'",
  sourceStatus:
    "UPDATE sources SET status=?,last_success=CASE WHEN ? THEN last_success ELSE ? END,error=?,imported_count=? WHERE id=? AND user_id=?",
  user: "SELECT id FROM users WHERE id=?",
} as const;
