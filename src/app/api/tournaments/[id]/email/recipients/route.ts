import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

/** GET: List recipients for a tournament (organizer only). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('email_recipients')
    .select('*')
    .eq('tournament_id', id)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST: Add recipients (single or bulk array). Organizer only. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();
  const body = await req.json();

  const items = Array.isArray(body) ? body : [body];

  const rows = items
    .filter((r: { name?: string; email?: string }) => r.name && r.email)
    .map((r: { name: string; email: string; type?: string; tags?: string[] }) => ({
      tournament_id: id,
      name: r.name.trim(),
      email: r.email.trim().toLowerCase(),
      type: ['invitee', 'player', 'volunteer', 'other'].includes(r.type || '')
        ? r.type
        : 'invitee',
      tags: Array.isArray(r.tags)
        ? r.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
        : [],
    }));

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid recipients' }, { status: 400 });
  }

  // Look up existing rows for these emails so we can UNION their tags (not overwrite).
  // Preserves any hand-curated tags (e.g. "ssra") already on the recipient.
  const emails = rows.map((r) => r.email);
  const { data: existing } = await supabase
    .from('email_recipients')
    .select('email, tags')
    .eq('tournament_id', id)
    .in('email', emails);
  const existingTagsByEmail = new Map<string, string[]>(
    (existing ?? []).map((r: { email: string; tags: string[] | null }) => [r.email, r.tags ?? []]),
  );

  // Deduplicate by email within the batch — Postgres throws
  // "ON CONFLICT DO UPDATE command cannot affect row a second time"
  // if the same email appears more than once in a single upsert statement.
  const deduped = new Map<string, typeof rows[0]>();
  for (const r of rows) {
    const existing2 = deduped.get(r.email);
    if (existing2) {
      // merge tags from both CSV rows
      deduped.set(r.email, { ...r, tags: Array.from(new Set([...existing2.tags, ...r.tags])) });
    } else {
      deduped.set(r.email, r);
    }
  }

  const mergedRows = Array.from(deduped.values()).map((r) => {
    const prior = existingTagsByEmail.get(r.email) ?? [];
    const merged = Array.from(new Set([...prior, ...r.tags]));
    return { ...r, tags: merged };
  });

  // ignoreDuplicates: false → on conflict, update existing rows. Since we pre-merged tags above,
  // the update preserves old tags + adds new ones. Name/type are taken from CSV (authoritative).
  // `subscribed` is NOT in the payload, so it remains untouched on existing rows.
  const { data, error } = await supabase
    .from('email_recipients')
    .upsert(mergedRows, { onConflict: 'tournament_id,email', ignoreDuplicates: false })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** PATCH: Update a recipient's name, type, and/or tags. Organizer only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { recipientId, name, type, tags } = await req.json();

  if (!recipientId) return NextResponse.json({ error: 'recipientId required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (type !== undefined && ['invitee', 'player', 'volunteer', 'other'].includes(type)) {
    updates.type = type;
  }
  if (tags !== undefined && Array.isArray(tags)) {
    updates.tags = tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('email_recipients')
    .update(updates)
    .eq('id', recipientId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE: Remove a recipient. Organizer only. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { recipientId } = await req.json();
  if (!recipientId) return NextResponse.json({ error: 'recipientId required' }, { status: 400 });

  // Scope to this tournament — prevents cross-tournament deletion by guessing UUIDs
  const { error } = await supabase
    .from('email_recipients')
    .delete()
    .eq('id', recipientId)
    .eq('tournament_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
