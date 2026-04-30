-- Add scorer_user_id to matches so only the claiming scorer can update scores
ALTER TABLE matches ADD COLUMN IF NOT EXISTS scorer_user_id text;
