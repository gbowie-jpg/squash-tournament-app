import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

type Params = { params: Promise<{ id: string; matchId: string }> };

/** GET: Fetch all media for a match. Public. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id, matchId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('match_media')
    .select('*')
    .eq('match_id', matchId)
    .eq('tournament_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST: Save a media record after client uploads the file to Storage.
 *  Body: { url, type, caption? }
 *  Auth required.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id, matchId } = await params;
  const body = await req.json();
  const { url, type, caption } = body;

  if (!url || !['photo', 'video'].includes(type)) {
    return NextResponse.json({ error: 'url and valid type (photo|video) required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify the match belongs to this tournament
  const { data: match } = await supabase
    .from('matches')
    .select('id')
    .eq('id', matchId)
    .eq('tournament_id', id)
    .single();

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('match_media')
    .insert({
      match_id: matchId,
      tournament_id: id,
      uploaded_by: auth.user.id,
      type,
      url,
      caption: caption || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** DELETE: Remove a media item. Must be the uploader or an organizer/admin. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id, matchId } = await params;
  const { searchParams } = new URL(req.url);
  const mediaId = searchParams.get('mediaId');
  if (!mediaId) return NextResponse.json({ error: 'mediaId required' }, { status: 400 });

  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from('match_media')
    .select('id, uploaded_by, url')
    .eq('id', mediaId)
    .eq('match_id', matchId)
    .single();

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Allow uploader, organizers, and global admins
  const isUploader = item.uploaded_by === auth.user.id;
  const isOrganizer = await supabase
    .from('organizers').select('id').eq('tournament_id', id).eq('user_id', auth.user.id)
    .maybeSingle().then(({ data }) => !!data);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  if (!isUploader && !isOrganizer && !isAdmin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  // Delete from storage if it's a Supabase Storage URL
  const storageMatch = item.url.match(/\/storage\/v1\/object\/public\/match-media\/(.+)/);
  if (storageMatch) {
    await supabase.storage.from('match-media').remove([storageMatch[1]]);
  }

  await supabase.from('match_media').delete().eq('id', mediaId);
  return NextResponse.json({ ok: true });
}
