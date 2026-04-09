import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('global_email_recipients')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const items = Array.isArray(body) ? body : [body];

  const rows = items
    .filter((r) => r.name && r.email)
    .map((r) => ({
      name: r.name.trim(),
      email: r.email.trim().toLowerCase(),
      tags: Array.isArray(r.tags) ? r.tags : r.tags ? [r.tags] : [],
    }));

  if (rows.length === 0) return NextResponse.json({ error: 'No valid recipients' }, { status: 400 });

  const { data, error } = await supabase
    .from('global_email_recipients')
    .upsert(rows, { onConflict: 'email', ignoreDuplicates: true })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { recipientId } = await req.json();
  if (!recipientId) return NextResponse.json({ error: 'recipientId required' }, { status: 400 });

  const { error } = await supabase.from('global_email_recipients').delete().eq('id', recipientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
