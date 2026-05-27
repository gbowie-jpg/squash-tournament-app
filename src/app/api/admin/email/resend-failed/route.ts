import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';
import { sendEmail, buildCampaignHtml, getEmailTemplateSettings } from '@/lib/email';

export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { campaignId } = await req.json();

  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const { data: campaign, error: cErr } = await supabase
    .from('global_email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Get failed send records
  const { data: failedSends } = await supabase
    .from('global_email_sends')
    .select('id, recipient_id')
    .eq('campaign_id', campaignId)
    .eq('status', 'failed');

  if (!failedSends || failedSends.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, failedRecipients: [], message: 'No failed sends to retry' });
  }

  const recipientIds = failedSends.map((s) => s.recipient_id);
  const { data: recipients } = await supabase
    .from('global_email_recipients')
    .select('*')
    .in('id', recipientIds);

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: 'Recipients not found' }, { status: 404 });
  }

  const sendIdMap: Record<string, string> = {};
  for (const s of failedSends) sendIdMap[s.recipient_id] = s.id;

  const template = await getEmailTemplateSettings(supabase);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.seattlesquash.com';

  let sentCount = 0;
  let failCount = 0;
  const failedRecipients: { name: string; email: string }[] = [];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const unsubscribeUrl = `${siteUrl}/api/unsubscribe?token=${recipient.unsubscribe_token}`;
    const html = buildCampaignHtml({ body: campaign.body, tournamentName: 'Seattle Squash', template, unsubscribeUrl });
    const result = await sendEmail({ to: recipient.email, subject: campaign.subject, html });

    const sendRecordId = sendIdMap[recipient.id];
    if (sendRecordId) {
      await supabase
        .from('global_email_sends')
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

  if (sentCount > 0) {
    await supabase
      .from('global_email_campaigns')
      .update({
        sent_count: (campaign.sent_count || 0) + sentCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
  }

  return NextResponse.json({ sent: sentCount, failed: failCount, failedRecipients });
}
