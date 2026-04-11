-- Extend profiles table with player-specific fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS squash_ranking text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS club text,
  ADD COLUMN IF NOT EXISTS phone text;

-- Supabase Storage: create player-photos bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-photos',
  'player-photos',
  true,
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can view player photos (public bucket)
CREATE POLICY "Player photos are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'player-photos');

-- RLS: authenticated users can upload their own photo (path = user_id/*)
CREATE POLICY "Users can upload own photo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'player-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: authenticated users can update/delete their own photo
CREATE POLICY "Users can update own photo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'player-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own photo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'player-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
