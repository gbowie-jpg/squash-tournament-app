import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';

/** POST: Add a user as an organizer for a tournament. Superadmin only. */
export async function POST(req: NextRequest) {
  const auth = await requireRole('superadmin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { userId, tournamentId, role = 'admin' } = await req.json();

  if (!userId || !tournamentId) {
    return NextResponse.json({ error: 'userId and tournamentId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('organizers')
    .upsert(
      { user_id: userId, tournament_id: tournamentId, role },
      { onConflict: 'tournament_id,user_id' },
    )
    .select('*, tournament:tournaments(id, name, slug)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** DELETE: Remove an organizer from a tournament. Superadmin only. */
export async function DELETE(req: NextRequest) {
  const auth = await requireRole('superadmin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { organizerId } = await req.json();

  if (!organizerId) {
    return NextResponse.json({ error: 'organizerId required' }, { status: 400 });
  }

  const { error } = await supabase.from('organizers').delete().eq('id', organizerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
