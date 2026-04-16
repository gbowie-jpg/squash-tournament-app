import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';

/** GET: List campaigns for a tournament (organizer only). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('tournament_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST: Create a new campaign (draft). Organizer only. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();
  const { subject, body, segment } = await req.json();

  if (!subject || !body) {
    return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 });
  }

  const validSegments = ['player', 'volunteer', 'invitee', 'other'];

  const { data, error } = await supabase
    .from('email_campaigns')
    .insert({
      tournament_id: id,
      subject: subject.trim(),
      body: body.trim(),
      segment: segment && validSegments.includes(segment) ? segment : null,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

/** PATCH: Update a draft campaign. Organizer only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { campaignId, subject, body } = await req.json();

  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (subject) updates.subject = subject.trim();
  if (body) updates.body = body.trim();

  const { data, error } = await supabase
    .from('email_campaigns')
    .update(updates)
    .eq('id', campaignId)
    .eq('status', 'draft')
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE: Delete a draft campaign. Organizer only. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { campaignId } = await req.json();
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const { error } = await supabase
    .from('email_campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('status', 'draft');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
