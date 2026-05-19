-- Add first_name and last_name to players for Club Locker import and bio pages
ALTER TABLE players ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_name text;
