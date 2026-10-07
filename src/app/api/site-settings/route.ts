import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';
import { PUBLIC_SETTING_KEYS, validateSettingsPatch } from '@/lib/site-settings';

// GET public site settings as a flat key→value object (public).
// Only allowlisted keys are ever returned — see src/lib/site-settings.ts.
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', [...PUBLIC_SETTING_KEYS]);

  if (error) {
    console.error('[site-settings] GET failed:', error.message);
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const settings: Record<string, string | null> = {};
  for (const row of (data ?? []) as { key: string; value: string | null }[]) {
    settings[row.key] = row.value;
  }
  return NextResponse.json(settings, { headers: { 'Cache-Control': 'no-store' } });
}

// PATCH — upsert one or many allowlisted keys (admin only)
export async function PATCH(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = validateSettingsPatch(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const now = new Date().toISOString();
  const rows = Object.entries(result.values).map(([key, value]) => ({
    key,
    value,
    updated_at: now,
  }));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('site_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
