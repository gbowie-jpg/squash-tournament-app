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

const PLAYER_FIELDS = ['name', 'first_name', 'last_name', 'draw', 'seed', 'club', 'email', 'phone', 'club_locker_id', 'gender', 'city', 'rating', 'ranking'] as const;

function sanitizePlayer(p: Record<string, unknown>, tournamentId: string) {
  const record: Record<string, unknown> = { tournament_id: tournamentId };
  if (typeof p.name === 'string' && p.name.trim()) record.name = p.name.trim();
  if (typeof p.first_name === 'string') record.first_name = p.first_name.trim() || null;
  if (typeof p.last_name === 'string') record.last_name = p.last_name.trim() || null;
  if (typeof p.draw === 'string') record.draw = p.draw.trim() || null;
  if (p.seed !== undefined) record.seed = typeof p.seed === 'number' ? p.seed : (parseInt(String(p.seed)) || null);
  if (typeof p.club === 'string') record.club = p.club.trim() || null;
  if (typeof p.email === 'string') record.email = p.email.trim() || null;
  if (typeof p.phone === 'string') record.phone = p.phone.trim() || null;
  if (typeof p.club_locker_id === 'string') record.club_locker_id = p.club_locker_id.trim() || null;
  if (typeof p.gender === 'string') record.gender = p.gender.trim() || null;
  if (typeof p.city === 'string') record.city = p.city.trim() || null;
  if (p.rating !== undefined) record.rating = typeof p.rating === 'number' ? p.rating : (parseFloat(String(p.rating)) || null);
  if (p.ranking !== undefined) record.ranking = typeof p.ranking === 'number' ? p.ranking : (parseInt(String(p.ranking)) || null);
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

  // Duplicate check — find any existing players in this tournament with the same email
  const incomingEmails = records
    .map((r) => (r.email as string | null | undefined))
    .filter((e): e is string => !!e)
    .map((e) => e.trim().toLowerCase());

  let duplicates: { name: string; email: string; existingName: string }[] = [];

  if (incomingEmails.length > 0) {
    const { data: existing } = await supabase
      .from('players')
      .select('name, email')
      .eq('tournament_id', id)
      .in('email', incomingEmails);

    if (existing && existing.length > 0) {
      const existingByEmail: Record<string, string> = {};
      for (const p of existing) {
        if (p.email) existingByEmail[p.email.toLowerCase()] = p.name;
      }

      // For single adds, block entirely and return conflict info
      if (!Array.isArray(body)) {
        const email = incomingEmails[0];
        if (existingByEmail[email]) {
          return NextResponse.json(
            { error: `A player with this email already exists: ${existingByEmail[email]}`, duplicate: true },
            { status: 409 },
          );
        }
      }

      // For bulk, skip duplicates and track them
      duplicates = records
        .filter((r) => {
          const e = (r.email as string | null | undefined)?.trim().toLowerCase();
          return e && existingByEmail[e];
        })
        .map((r) => {
          const e = (r.email as string).trim().toLowerCase();
          return { name: r.name as string, email: e, existingName: existingByEmail[e] };
        });

      // Remove duplicates from records to insert
      const dupEmails = new Set(duplicates.map((d) => d.email));
      records.splice(0, records.length, ...records.filter((r) => {
        const e = (r.email as string | null | undefined)?.trim().toLowerCase();
        return !e || !dupEmails.has(e);
      }));
    }
  }

  // If all records were duplicates in a bulk import, return early
  if (records.length === 0) {
    return NextResponse.json({ data: [], duplicates }, { status: 200 });
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

  if (Array.isArray(body)) {
    return NextResponse.json({ data, duplicates }, { status: 201 });
  }
  return NextResponse.json(data[0], { status: 201 });
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
      if (key === 'seed' || key === 'ranking') {
        updates[key] = body[key] ? parseInt(String(body[key])) || null : null;
      } else if (key === 'rating') {
        updates[key] = body[key] ? parseFloat(String(body[key])) || null : null;
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
  const body = await req.json();

  // Support single playerId (legacy) or bulk playerIds array
  const ids: string[] = body.playerIds ?? (body.playerId ? [body.playerId] : []);
  if (ids.length === 0) return NextResponse.json({ error: 'playerId or playerIds required' }, { status: 400 });

  // Check for active matches involving any of these players
  const orClause = ids.map((pid) => `player1_id.eq.${pid},player2_id.eq.${pid}`).join(',');
  const { data: activeMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', id)
    .in('status', ['scheduled', 'on_deck', 'in_progress'])
    .or(orClause)
    .limit(1);

  if (activeMatches && activeMatches.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete: one or more players have active matches. Remove them from matches first.' },
      { status: 409 },
    );
  }

  const { error } = await supabase.from('players').delete().in('id', ids).eq('tournament_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: ids.length });
}
