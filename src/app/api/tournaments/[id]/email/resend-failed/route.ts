import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireTournamentOrganizer } from '@/lib/supabase/require-role';
import { sendEmail, buildCampaignHtml, getEmailTemplateSettings } from '@/lib/email';

/** POST: Retry all failed sends for a campaign. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireTournamentOrganizer(id);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { campaignId } = await req.json();

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
  }

  // Get campaign
  const { data: campaign, error: cErr } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('tournament_id', id)
    .single();

  if (cErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Get failed send records for this campaign
  const { data: failedSends } = await supabase
    .from('email_sends')
    .select('id, recipient_id')
    .eq('campaign_id', campaignId)
    .eq('status', 'failed');

  if (!failedSends || failedSends.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, failedRecipients: [], message: 'No failed sends to retry' });
  }

  // Look up recipient details
  const recipientIds = failedSends.map((s) => s.recipient_id);
  const { data: recipients } = await supabase
    .from('email_recipients')
    .select('*')
    .in('id', recipientIds);

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: 'Recipients not found' }, { status: 404 });
  }

  // Build a map of recipientId → send record id for updating status
  const sendIdMap: Record<string, string> = {};
  for (const s of failedSends) sendIdMap[s.recipient_id] = s.id;

  // Get tournament name
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('name')
    .eq('id', id)
    .single();

  const template = await getEmailTemplateSettings(supabase);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.seattlesquash.com';

  let sentCount = 0;
  let failCount = 0;
  const failedRecipients: { name: string; email: string }[] = [];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const unsubscribeUrl = `${siteUrl}/api/unsubscribe?token=${recipient.unsubscribe_token}`;
    const html = buildCampaignHtml({
      body: campaign.body,
      tournamentName: tournament?.name || 'Tournament',
      template,
      unsubscribeUrl,
    });

    const result = await sendEmail({
      to: recipient.email,
      subject: campaign.subject,
      html,
    });

    // Update the existing failed send record in place
    const sendRecordId = sendIdMap[recipient.id];
    if (sendRecordId) {
      await supabase
        .from('email_sends')
        .update({
          status: result.success ? 'sent' : 'failed',
          error: result.success ? null : result.error,
          sent_at: result.success ? new Date().toISOString() : null,
        })
        .eq('id', sendRecordId);
    }

    if (result.success) {
      sentCount++;
    } else {
      failCount++;
      failedRecipients.push({ name: recipient.name || '', email: recipient.email });
    }

    if (i < recipients.length - 1) await sleep(250);
  }

  // Update campaign sent_count to reflect newly successful sends
  if (sentCount > 0) {
    await supabase
      .from('email_campaigns')
      .update({
        sent_count: (campaign.sent_count || 0) + sentCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
  }

  return NextResponse.json({ sent: sentCount, failed: failCount, failedRecipients });
}
