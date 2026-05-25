import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';
import { requireRole } from '@/lib/supabase/require-role';

/** GET /api/messages — list all messages with per-user read status */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const [{ data: msgs }, { data: reads }] = await Promise.all([
    admin.from('messages').select('*').order('created_at', { ascending: false }),
    admin.from('message_reads').select('message_id').eq('user_id', auth.user.id),
  ]);

  const readSet = new Set((reads ?? []).map((r) => r.message_id));
  const result = (msgs ?? []).map((m) => ({ ...m, read: readSet.has(m.id) }));
  return NextResponse.json(result);
}

/** POST /api/messages — admin creates a message (broadcast to all users' inboxes) */
export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const body = await req.json();
  const { title, body: msgBody, tournament_id } = body;

  if (!title?.trim() || !msgBody?.trim()) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('messages')
    .insert({
      title: title.trim(),
      body: msgBody.trim(),
      tournament_id: tournament_id || null,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
