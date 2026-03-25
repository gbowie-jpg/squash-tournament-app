import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

// GET single tournament
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH update tournament (auth required)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = createAdminClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('tournaments')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE tournament (auth required)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from('tournaments').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
