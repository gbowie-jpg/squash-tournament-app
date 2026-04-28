import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

// GET /api/tournaments/[id]/videos?status=pending|approved|all&player_id=xxx
// Public callers only get approved videos. pending/rejected/all requires organizer auth.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const requestedStatus = url.searchParams.get('status') || 'approved';
  const playerId = url.searchParams.get('player_id');

  // Non-approved requests require organizer/admin access
  if (requestedStatus !== 'approved') {
    const auth = await requireTournamentOrganizer(id);
    if (auth.error) return auth.error;
  }

  // Clamp to valid values to prevent arbitrary filter injection
  const validStatuses = ['approved', 'pending', 'rejected', 'all'];
  const status = validStatuses.includes(requestedStatus) ? requestedStatus : 'approved';

  const supabase = createAdminClient();

  let query = supabase
    .from('player_videos')
    .select('*, player:players!player_id(name, tournament_id)')
    .eq('tournament_id', id)
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }
  if (playerId) {
    query = query.eq('player_id', playerId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/tournaments/[id]/videos — record a video after upload (any auth user)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  // Validate required fields
  if (!body.player_id || typeof body.player_id !== 'string') {
    return NextResponse.json({ error: 'player_id is required' }, { status: 400 });
  }
  if (!body.storage_path || typeof body.storage_path !== 'string') {
    return NextResponse.json({ error: 'storage_path is required' }, { status: 400 });
  }

  // Verify player_id actually belongs to this tournament — prevents cross-tournament video injection
  const { data: playerCheck } = await supabase
    .from('players')
    .select('id')
    .eq('id', body.player_id)
    .eq('tournament_id', id)
    .maybeSingle();

  if (!playerCheck) {
    return NextResponse.json({ error: 'player_id not found in this tournament' }, { status: 400 });
  }

  // Validate file size (500MB max)
  if (body.file_size_bytes && body.file_size_bytes > 500 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 500MB)' }, { status: 400 });
  }

  // Whitelist mime types — never trust the client string directly
  const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'];
  const mimeType = allowedMimeTypes.includes(body.mime_type) ? body.mime_type : 'video/mp4';

  const { data, error } = await supabase
    .from('player_videos')
    .insert({
      tournament_id: id,
      player_id: body.player_id,
      title: typeof body.title === 'string' ? body.title.trim() || null : null,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      storage_path: body.storage_path,
      public_url: body.public_url || null,
      file_size_bytes: typeof body.file_size_bytes === 'number' ? body.file_size_bytes : null,
      mime_type: mimeType,
      uploaded_by: auth.user.id,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/tournaments/[id]/videos — approve or reject a video (organizer only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const { id: videoId, status, rejection_reason } = body;

  if (!videoId) return NextResponse.json({ error: 'Video id required' }, { status: 400 });
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status must be approved or rejected' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('player_videos')
    .update({
      status,
      rejection_reason: typeof rejection_reason === 'string' ? rejection_reason.trim() || null : null,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .eq('tournament_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/tournaments/[id]/videos (organizer only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { videoId } = await req.json();

  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });

  // Get the video first to delete from storage
  const { data: video } = await supabase
    .from('player_videos')
    .select('storage_path')
    .eq('id', videoId)
    .eq('tournament_id', id)
    .single();

  if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

  if (video.storage_path) {
    await supabase.storage.from('player-videos').remove([video.storage_path]);
  }

  const { error } = await supabase.from('player_videos').delete().eq('id', videoId).eq('tournament_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
