-- Match media: photos and videos uploaded by scorers/players
CREATE TABLE IF NOT EXISTS match_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES matches(id) ON DELETE CASCADE,
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  uploaded_by uuid,  -- auth.users.id (nullable — anonymous uploads allowed)
  type text CHECK (type IN ('photo','video')),
  url text NOT NULL,
  caption text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_media_match ON match_media(match_id);
CREATE INDEX IF NOT EXISTS idx_match_media_tournament ON match_media(tournament_id);
