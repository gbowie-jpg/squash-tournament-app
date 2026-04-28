import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';

// Keys that must never be exposed via the public GET endpoint
const SENSITIVE_KEY_PATTERNS = ['secret', 'private', 'webhook'];
const isSensitive = (key: string) =>
  SENSITIVE_KEY_PATTERNS.some((p) => key.toLowerCase().includes(p));

// GET all non-sensitive site settings as a flat key→value object (public)
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('site_settings').select('key, value');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const settings: Record<string, string | null> = {};
  for (const row of data || []) {
    if (!isSensitive(row.key)) settings[row.key] = row.value;
  }
  return NextResponse.json(settings);
}

// PATCH — upsert one or many keys (admin only)
export async function PATCH(req: NextRequest) {
  const auth = await requireRole('admin');
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
