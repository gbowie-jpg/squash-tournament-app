import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

// POST /api/messages/[id]/read — mark one message as read
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params;
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { error } = await admin
    .from('message_reads')
    .upsert({ message_id: messageId, user_id: auth.user.id }, { ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/messages/[id]/read — mark one message as unread
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: messageId } = await params;
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { error } = await admin
    .from('message_reads')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
