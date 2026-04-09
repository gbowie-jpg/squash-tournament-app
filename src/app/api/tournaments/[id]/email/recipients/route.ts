import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

/** GET: List recipients for a tournament. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('email_recipients')
    .select('*')
    .eq('tournament_id', id)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST: Add recipients (single or bulk array). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  // Accept single object or array
  const items = Array.isArray(body) ? body : [body];

  const rows = items
    .filter((r: { name?: string; email?: string }) => r.name && r.email)
    .map((r: { name: string; email: string; type?: string }) => ({
      tournament_id: id,
      name: r.name.trim(),
      email: r.email.trim().toLowerCase(),
      type: ['invitee', 'player', 'volunteer', 'other'].includes(r.type || '')
        ? r.type
        : 'invitee',
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid recipients' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('email_recipients')
    .upsert(rows, { onConflict: 'tournament_id,email', ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** DELETE: Remove a recipient. */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { recipientId } = await req.json();
  if (!recipientId) return NextResponse.json({ error: 'recipientId required' }, { status: 400 });

  const { error } = await supabase.from('email_recipients').delete().eq('id', recipientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
