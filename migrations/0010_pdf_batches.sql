ALTER TABLE material_files ADD COLUMN material_ids TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(material_ids));
ALTER TABLE material_files ADD COLUMN issue TEXT NOT NULL DEFAULT '';
ALTER TABLE material_files ADD COLUMN pages_done INTEGER NOT NULL DEFAULT 0;
ALTER TABLE material_files ADD COLUMN pages_total INTEGER NOT NULL DEFAULT 0;
UPDATE material_files SET material_ids=json_array(material_id) WHERE material_id IS NOT NULL;
UPDATE material_files SET checked_at=0 WHERE state='unreadable';
