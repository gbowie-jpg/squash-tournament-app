import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();

  const allowed = ['full_name', 'squash_ranking', 'bio', 'club', 'phone', 'photo_url'];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Upsert in case profile row doesn't exist yet
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: auth.user.id, email: auth.user.email, ...updates })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
