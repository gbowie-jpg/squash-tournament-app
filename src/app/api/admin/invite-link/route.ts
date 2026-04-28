import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';
import { randomUUID } from 'crypto';

const KEY = 'invite_token';

/** GET — return the current invite token (admin only). Creates one if missing. */
export async function GET() {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle();

  let token = data?.value;
  if (!token) {
    token = randomUUID();
    await supabase.from('site_settings').upsert(
      { key: KEY, value: token, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  }

  return NextResponse.json({ token });
}

/** POST — regenerate the invite token (admin only). Old link stops working immediately. */
export async function POST() {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const token = randomUUID();
  await supabase.from('site_settings').upsert(
    { key: KEY, value: token, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );

  return NextResponse.json({ token });
}
