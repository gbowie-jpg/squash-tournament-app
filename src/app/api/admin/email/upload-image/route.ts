import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const ALLOWED_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, GIF, WEBP images allowed' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: 'Invalid file extension' }, { status: 400 });
  }
  const path = `email/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const bytes = await file.arrayBuffer();
  const admin = createAdminClient();

  const { error } = await admin.storage
    .from('tournament-images')
    .upload(path, Buffer.from(bytes), { contentType: file.type || 'image/jpeg' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from('tournament-images').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
