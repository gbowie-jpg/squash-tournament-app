import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

/** GET /api/messages/unread — lightweight unread count for the nav badge */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return NextResponse.json({ count: 0 }); // return 0 rather than 401 — badge just stays hidden

  const admin = createAdminClient();
  const [{ data: msgs }, { data: reads }] = await Promise.all([
    admin.from('messages').select('id'),
    admin.from('message_reads').select('message_id').eq('user_id', auth.user.id),
  ]);

  const readSet = new Set((reads ?? []).map((r) => r.message_id));
  const count = (msgs ?? []).filter((m) => !readSet.has(m.id)).length;
  return NextResponse.json({ count });
}
