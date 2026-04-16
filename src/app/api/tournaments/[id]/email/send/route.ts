import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';
import { sendEmail, buildCampaignHtml, getEmailTemplateSettings } from '@/lib/email';

/** POST: Send a campaign to all subscribed recipients (organizer only). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();
  const reqBody = await req.json();
  const { campaignId, tags: filterTags, segment: bodySegment } = reqBody;

  // Optional filters passed from compose form
  const segment = req.nextUrl.searchParams.get('segment') || bodySegment;
  const validSegments = ['player', 'volunteer', 'invitee', 'other'];

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
  }

  // Get campaign
  const { data: campaign, error: cErr } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (cErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (campaign.status === 'sent') {
    return NextResponse.json({ error: 'Campaign already sent' }, { status: 400 });
  }

  // Get tournament name
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('name')
    .eq('id', id)
    .single();

  // Get subscribed recipients, filtered by segment if provided
  let query = supabase
    .from('email_recipients')
    .select('*')
    .eq('tournament_id', id)
    .eq('subscribed', true);

  if (segment && validSegments.includes(segment)) {
    query = query.eq('type', segment);
  }
  if (filterTags && Array.isArray(filterTags) && filterTags.length > 0) {
    query = query.overlaps('tags', filterTags);
  }

  const { data: recipients } = await query;

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: 'No subscribed recipients' }, { status: 400 });
  }

  // Mark campaign as sending
  await supabase
    .from('email_campaigns')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  const template = await getEmailTemplateSettings(supabase);
  const html = buildCampaignHtml({
    body: campaign.body,
    tournamentName: tournament?.name || 'Tournament',
    template,
  });

  let sentCount = 0;
  let failCount = 0;

  // Send to each recipient and track
  for (const recipient of recipients) {
    const result = await sendEmail({
      to: recipient.email,
      subject: campaign.subject,
      html,
    });

    await supabase.from('email_sends').insert({
      campaign_id: campaignId,
      recipient_id: recipient.id,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : result.error,
      sent_at: result.success ? new Date().toISOString() : null,
    });

    if (result.success) sentCount++;
    else failCount++;
  }

  // Update campaign status
  await supabase
    .from('email_campaigns')
    .update({
      status: failCount === recipients.length ? 'failed' : 'sent',
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  return NextResponse.json({ sent: sentCount, failed: failCount });
}
