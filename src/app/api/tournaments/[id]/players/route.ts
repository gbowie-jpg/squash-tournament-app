import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

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

const PLAYER_FIELDS = ['name', 'draw', 'seed', 'club', 'email', 'phone'] as const;

function sanitizePlayer(p: Record<string, unknown>, tournamentId: string) {
  const record: Record<string, unknown> = { tournament_id: tournamentId };
  if (typeof p.name === 'string' && p.name.trim()) record.name = p.name.trim();
  if (typeof p.draw === 'string') record.draw = p.draw.trim() || null;
  if (p.seed !== undefined) record.seed = typeof p.seed === 'number' ? p.seed : (parseInt(String(p.seed)) || null);
  if (typeof p.club === 'string') record.club = p.club.trim() || null;
  if (typeof p.email === 'string') record.email = p.email.trim() || null;
  if (typeof p.phone === 'string') record.phone = p.phone.trim() || null;
  return record;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();

  // Support bulk insert (array) or single
  const items = Array.isArray(body) ? body : [body];
  const records = items
    .map((p: Record<string, unknown>) => sanitizePlayer(p, id))
    .filter((r) => r.name); // Name is required

  if (records.length === 0) {
    return NextResponse.json({ error: 'No valid players (name is required)' }, { status: 400 });
  }

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const { id: playerId } = body;

  if (!playerId) return NextResponse.json({ error: 'Player id required' }, { status: 400 });

  // Whitelist fields
  const updates: Record<string, unknown> = {};
  for (const key of PLAYER_FIELDS) {
    if (key in body) {
      if (key === 'seed') {
        updates.seed = body.seed ? parseInt(String(body.seed)) || null : null;
      } else {
        updates[key] = typeof body[key] === 'string' ? (body[key].trim() || null) : body[key];
      }
    }
  }

  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', playerId)
    .eq('tournament_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { playerId } = await req.json();

  if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

  // Check for active matches involving this player
  const { data: activeMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', id)
    .in('status', ['scheduled', 'on_deck', 'in_progress'])
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .limit(1);

  if (activeMatches && activeMatches.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete: player has active matches. Remove them from matches first.' },
      { status: 409 },
    );
  }

  const { error } = await supabase.from('players').delete().eq('id', playerId).eq('tournament_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
