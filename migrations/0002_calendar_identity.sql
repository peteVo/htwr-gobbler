-- Reject concurrent cross-source duplicates without deleting or merging existing records.
CREATE UNIQUE INDEX items_calendar_identity ON items(user_id, external_id)
WHERE source_id IS NOT NULL AND external_id IS NOT NULL;
