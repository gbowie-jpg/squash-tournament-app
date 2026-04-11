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

/** PATCH: Update a recipient's name, type, and/or tags. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { recipientId, name, type, tags } = await req.json();

  if (!recipientId) return NextResponse.json({ error: 'recipientId required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (type !== undefined && ['invitee', 'player', 'volunteer', 'other'].includes(type)) {
    updates.type = type;
  }
  if (tags !== undefined && Array.isArray(tags)) {
    updates.tags = tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('email_recipients')
    .update(updates)
    .eq('id', recipientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
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
