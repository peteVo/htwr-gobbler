ALTER TABLE items ADD COLUMN document_key TEXT;
ALTER TABLE items ADD COLUMN document_name TEXT;
ALTER TABLE items ADD COLUMN document_hash TEXT;
CREATE UNIQUE INDEX items_document_identity ON items(user_id, course_id, document_key)
WHERE document_key IS NOT NULL AND course_id IS NOT NULL;
