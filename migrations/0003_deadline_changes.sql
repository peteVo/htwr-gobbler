ALTER TABLE changes ADD COLUMN previous_starts_at TEXT;
ALTER TABLE changes ADD COLUMN next_starts_at TEXT;
ALTER TABLE changes ADD COLUMN previous_all_day INTEGER;
ALTER TABLE changes ADD COLUMN next_all_day INTEGER;
