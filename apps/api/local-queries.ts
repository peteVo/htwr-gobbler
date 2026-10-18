// Fixed account-scoped operations for the authenticated loopback runner.
export const localQueries = {
  courseName: "SELECT name FROM courses WHERE id=? AND user_id=?",
  connectSource:
    "INSERT INTO sources (id,user_id,name,kind) VALUES (?,?,?,'folder') ON CONFLICT(id) DO NOTHING",
  source: "SELECT id FROM sources WHERE id=? AND user_id=? AND kind='folder'",
  ownedCourse: "SELECT id FROM courses WHERE id=? AND user_id=?",
  attempt: "UPDATE sources SET last_attempt=? WHERE id=? AND user_id=?",
  unavailableFile:
    "UPDATE material_files SET state='unreadable',issue='indexing',pages_done=0,pages_total=0 WHERE user_id=? AND source_id=? AND relative_path=?",
  file: "SELECT file_hash,state,material_id,checked_at,issue FROM material_files WHERE user_id=? AND source_id=? AND relative_path=?",
  saveMaterial:
    "INSERT INTO materials (id,user_id,course_id,name,source_url,pages,content_hash,created_at,managed,candidates) SELECT ?,?,?,?,'',?,?,?,1,? WHERE (SELECT COUNT(*) FROM materials WHERE user_id=?)<500 AND (SELECT COALESCE(SUM(length(pages)),0) FROM materials WHERE user_id=?) + length(?5)<=5000000 ON CONFLICT(user_id,course_id,content_hash) DO NOTHING",
  material:
    "SELECT id FROM materials WHERE user_id=? AND course_id=? AND content_hash=?",
  bindFile:
    "INSERT INTO material_files (user_id,source_id,relative_path,material_id,file_hash,material_ids,pages_done,pages_total,state) VALUES (?,?,?,?,?,?,?,?,'available') ON CONFLICT(user_id,source_id,relative_path) DO UPDATE SET material_id=excluded.material_id,file_hash=excluded.file_hash,material_ids=excluded.material_ids,pages_done=excluded.pages_done,pages_total=excluded.pages_total,state='available',issue=''",
  failedFile:
    "INSERT INTO material_files (user_id,source_id,relative_path,state,file_hash,checked_at,issue) VALUES (?,?,?,'unreadable',?,?,?) ON CONFLICT(user_id,source_id,relative_path) DO UPDATE SET state='unreadable',file_hash=excluded.file_hash,checked_at=excluded.checked_at,issue=excluded.issue",
  pendingFile:
    "INSERT INTO material_files (user_id,source_id,relative_path,state,file_hash,checked_at,issue,pages_done,pages_total) VALUES (?,?,?,'unreadable',?,?,'indexing',?,?) ON CONFLICT(user_id,source_id,relative_path) DO UPDATE SET state='unreadable',file_hash=excluded.file_hash,checked_at=excluded.checked_at,issue='indexing',pages_done=excluded.pages_done,pages_total=excluded.pages_total",
  files:
    "SELECT relative_path FROM material_files WHERE user_id=? AND source_id=?",
  missingFile:
    "UPDATE material_files SET state='missing',issue='missing' WHERE user_id=? AND source_id=? AND relative_path=?",
  unavailableFolder:
    "UPDATE material_files SET state='unreadable',issue='folder' WHERE user_id=? AND source_id=?",
  discardSuperseded:
    "DELETE FROM materials WHERE user_id=? AND managed=1 AND NOT EXISTS (SELECT 1 FROM material_files WHERE material_id=materials.id OR EXISTS (SELECT 1 FROM json_each(material_files.material_ids) WHERE value=materials.id))",
  countFiles:
    "SELECT COUNT(*) AS n FROM material_files WHERE user_id=? AND source_id=? AND state='available'",
  sourceStatus:
    "UPDATE sources SET status=?,last_success=CASE WHEN ? THEN last_success ELSE ? END,error=?,imported_count=? WHERE id=? AND user_id=?",
  user: "SELECT id FROM users WHERE id=?",
} as const;
