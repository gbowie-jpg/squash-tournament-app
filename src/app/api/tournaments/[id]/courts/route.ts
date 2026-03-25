import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('courts')
    .select('*')
    .eq('tournament_id', id)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('courts')
    .insert({ ...body, tournament_id: id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();
  const body = await req.json();
  const courtId = body.id;
  const updates: Record<string, unknown> = { ...body };
  delete updates.id;

  const { data, error } = await supabase
    .from('courts')
    .update(updates as any)
    .eq('id', courtId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient();
  const { courtId } = await req.json();

  const { error } = await supabase.from('courts').delete().eq('id', courtId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
