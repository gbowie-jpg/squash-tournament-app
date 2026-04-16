import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';

export async function GET() {
  const auth = await requireRole('admin');
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
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const items = Array.isArray(body) ? body : [body];

  const rows = items
    .filter((r) => r.name && r.email)
    .map((r) => ({
      name: r.name.trim(),
      email: r.email.trim().toLowerCase(),
      tags: Array.isArray(r.tags)
        ? r.tags.map((t: string) => String(t).trim().toLowerCase()).filter(Boolean)
        : r.tags
          ? [String(r.tags).trim().toLowerCase()]
          : [],
    }));

  if (rows.length === 0) return NextResponse.json({ error: 'No valid recipients' }, { status: 400 });

  // Merge tags with any existing recipient's tags (UNION) so re-uploads add without overwriting.
  const emails = rows.map((r) => r.email);
  const { data: existing } = await supabase
    .from('global_email_recipients')
    .select('email, tags')
    .in('email', emails);
  const existingTagsByEmail = new Map<string, string[]>(
    (existing ?? []).map((r: { email: string; tags: string[] | null }) => [r.email, r.tags ?? []]),
  );
  const mergedRows = rows.map((r) => ({
    ...r,
    tags: Array.from(new Set([...(existingTagsByEmail.get(r.email) ?? []), ...r.tags])),
  }));

  // subscribed state is not in the payload, so it's untouched on re-upload.
  const { data, error } = await supabase
    .from('global_email_recipients')
    .upsert(mergedRows, { onConflict: 'email', ignoreDuplicates: false })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { recipientId, name, email, tags } = await req.json();
  if (!recipientId) return NextResponse.json({ error: 'recipientId required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (email !== undefined) updates.email = email.trim().toLowerCase();
  if (tags !== undefined && Array.isArray(tags)) {
    updates.tags = tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean);
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabase
    .from('global_email_recipients')
    .update(updates)
    .eq('id', recipientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { recipientId } = await req.json();
  if (!recipientId) return NextResponse.json({ error: 'recipientId required' }, { status: 400 });

  const { error } = await supabase.from('global_email_recipients').delete().eq('id', recipientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
