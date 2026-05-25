import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/tournaments/[id]/media
 * All match media for a tournament, joined with match player names.
 * Admin/organizer only.
 */
export async function GET(
  _req: NextRequest,
  { params }: Params,
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('match_media')
    .select(`
      *,
      match:matches!match_id(
        id,
        draw,
        round,
        player1:players!player1_id(name),
        player2:players!player2_id(name)
      )
    `)
    .eq('tournament_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * DELETE /api/tournaments/[id]/media?mediaId=xxx
 * Remove any media item for this tournament. Admin/organizer only.
 */
export async function DELETE(
  req: NextRequest,
  { params }: Params,
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const mediaId = searchParams.get('mediaId');
  if (!mediaId) return NextResponse.json({ error: 'mediaId required' }, { status: 400 });

  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from('match_media')
    .select('id, url')
    .eq('id', mediaId)
    .eq('tournament_id', id)
    .single();

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Delete from Supabase Storage if applicable
  const storageMatch = item.url.match(/\/storage\/v1\/object\/public\/match-media\/(.+)/);
  if (storageMatch) {
    await supabase.storage.from('match-media').remove([storageMatch[1]]);
  }

  await supabase.from('match_media').delete().eq('id', mediaId);
  return NextResponse.json({ ok: true });
}
