import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', id)
    .order('draw')
    .order('seed', { nullsFirst: false })
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  // Support bulk insert (array) or single
  const records = Array.isArray(body)
    ? body.map((p: Record<string, unknown>) => ({ ...p, tournament_id: id }))
    : [{ ...body, tournament_id: id }];

  const { data, error } = await supabase
    .from('players')
    .insert(records)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-sync players with emails into email_recipients
  const withEmail = (data || []).filter((p: { email?: string | null; name: string }) => p.email);
  if (withEmail.length > 0) {
    await supabase.from('email_recipients').upsert(
      withEmail.map((p: { name: string; email: string }) => ({
        tournament_id: id,
        name: p.name,
        email: p.email.trim().toLowerCase(),
        type: 'player',
      })),
      { onConflict: 'tournament_id,email', ignoreDuplicates: true },
    );
  }

  return NextResponse.json(Array.isArray(body) ? data : data[0], { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const { id: playerId, ...updates } = body;

  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', playerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { playerId } = await req.json();

  const { error } = await supabase.from('players').delete().eq('id', playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
