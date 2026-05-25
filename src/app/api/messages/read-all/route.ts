import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

/** POST /api/messages/read-all — mark every message as read for the current user */
export async function POST() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { data: msgs } = await admin.from('messages').select('id');
  if (!msgs?.length) return NextResponse.json({ ok: true });

  const upserts = msgs.map((m) => ({ message_id: m.id, user_id: auth.user.id }));
  await admin
    .from('message_reads')
    .upsert(upserts, { onConflict: 'message_id,user_id', ignoreDuplicates: true });

  return NextResponse.json({ ok: true });
}
