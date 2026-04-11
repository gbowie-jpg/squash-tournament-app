import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

/** POST: Upload a player profile photo.
 *  Accepts multipart/form-data with a `file` field.
 *  Returns { url } — the public URL of the uploaded image.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP or GIF allowed' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${auth.user.id}/avatar.${ext}`;
  const bytes = await file.arrayBuffer();

  const supabase = createAdminClient();

  // Remove old photo first (ignore errors — may not exist)
  await supabase.storage.from('player-photos').remove([path]);

  const { error: uploadErr } = await supabase.storage
    .from('player-photos')
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('player-photos').getPublicUrl(path);
  const url = `${urlData.publicUrl}?t=${Date.now()}`;

  // Save photo_url to profile
  await supabase
    .from('profiles')
    .upsert({ id: auth.user.id, email: auth.user.email, photo_url: url, updated_at: new Date().toISOString() });

  return NextResponse.json({ url });
}
