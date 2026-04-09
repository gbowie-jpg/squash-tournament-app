import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';
import { sendEmail, buildCampaignHtml } from '@/lib/email';

/** POST: Send a campaign to all subscribed recipients. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
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

  // Get subscribed recipients
  const { data: recipients } = await supabase
    .from('email_recipients')
    .select('*')
    .eq('tournament_id', id)
    .eq('subscribed', true);

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: 'No subscribed recipients' }, { status: 400 });
  }

  // Mark campaign as sending
  await supabase
    .from('email_campaigns')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  const html = buildCampaignHtml({
    body: campaign.body,
    tournamentName: tournament?.name || 'Tournament',
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
