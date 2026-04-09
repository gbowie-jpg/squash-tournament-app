import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

// GET all site settings as a flat key→value object
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('site_settings').select('key, value');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings: Record<string, string | null> = {};
  for (const row of data || []) settings[row.key] = row.value;
  return NextResponse.json(settings);
}

// PATCH — upsert one or many keys: { key: value, ... }
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body: Record<string, string | null> = await req.json();

  const rows = Object.entries(body).map(([key, value]) => ({
    key,
    value: value === '' ? null : value,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
