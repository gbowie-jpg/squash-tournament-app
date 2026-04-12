import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

// GET /api/tournaments/[id]/videos?status=pending|approved|all&player_id=xxx
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'approved';
  const playerId = url.searchParams.get('player_id');

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

// POST /api/tournaments/[id]/videos — record a video after upload
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('player_videos')
    .insert({
      tournament_id: id,
      player_id: body.player_id,
      title: body.title || null,
      description: body.description || null,
      storage_path: body.storage_path,
      public_url: body.public_url || null,
      file_size_bytes: body.file_size_bytes || null,
      mime_type: body.mime_type || 'video/mp4',
      uploaded_by: auth.user.id,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/tournaments/[id]/videos — approve or reject a video (admin)
export async function PATCH(
  req: NextRequest,
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const { id: videoId, status, rejection_reason } = body;

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('player_videos')
    .update({
      status,
      rejection_reason: rejection_reason || null,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', videoId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/tournaments/[id]/videos
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { videoId } = await req.json();

  // Get the video first to delete from storage
  const { data: video } = await supabase
    .from('player_videos')
    .select('storage_path')
    .eq('id', videoId)
    .single();

  if (video?.storage_path) {
    await supabase.storage.from('player-videos').remove([video.storage_path]);
  }

  const { error } = await supabase.from('player_videos').delete().eq('id', videoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
