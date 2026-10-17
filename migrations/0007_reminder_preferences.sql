ALTER TABLE preferences ADD COLUMN reminder_hours INTEGER NOT NULL DEFAULT 24 CHECK(reminder_hours IN (1,6,24,48,168));
ALTER TABLE preferences ADD COLUMN deadline_changes INTEGER NOT NULL DEFAULT 1 CHECK(deadline_changes IN (0,1));
