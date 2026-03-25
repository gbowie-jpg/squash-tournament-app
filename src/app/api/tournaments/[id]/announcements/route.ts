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
    .from('announcements')
    .select('*')
    .eq('tournament_id', id)
    .order('created_at', { ascending: false });

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

  const { data, error } = await supabase
    .from('announcements')
    .insert({ ...body, tournament_id: id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { announcementId } = await req.json();

  const { error } = await supabase.from('announcements').delete().eq('id', announcementId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
