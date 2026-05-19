-- Extended player fields for Club Locker import
ALTER TABLE players ADD COLUMN IF NOT EXISTS club_locker_id text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS rating numeric;
ALTER TABLE players ADD COLUMN IF NOT EXISTS ranking integer;
