import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth-check';
import { sendEmail, buildCampaignHtml } from '@/lib/email';

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { campaignId, tags } = await req.json();

  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const { data: campaign, error: cErr } = await supabase
    .from('global_email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  if (campaign.status === 'sent') return NextResponse.json({ error: 'Already sent' }, { status: 400 });

  // Get recipients, optionally filtered by tags
  let query = supabase
    .from('global_email_recipients')
    .select('*')
    .eq('subscribed', true);

  if (tags && Array.isArray(tags) && tags.length > 0) {
    query = query.overlaps('tags', tags);
  }

  const { data: recipients } = await query;
  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: 'No subscribed recipients' }, { status: 400 });
  }

  await supabase
    .from('global_email_campaigns')
    .update({ status: 'sending', updated_at: new Date().toISOString() })
    .eq('id', campaignId);

  const html = buildCampaignHtml({ body: campaign.body, tournamentName: 'Seattle Squash' });

  let sentCount = 0;
  let failCount = 0;

  for (const recipient of recipients) {
    const result = await sendEmail({ to: recipient.email, subject: campaign.subject, html });

    await supabase.from('global_email_sends').insert({
      campaign_id: campaignId,
      recipient_id: recipient.id,
      status: result.success ? 'sent' : 'failed',
      error: result.success ? null : result.error,
      sent_at: result.success ? new Date().toISOString() : null,
    });

    if (result.success) sentCount++;
    else failCount++;
  }

  await supabase
    .from('global_email_campaigns')
    .update({
      status: failCount === recipients.length ? 'failed' : 'sent',
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  return NextResponse.json({ sent: sentCount, failed: failCount });
}
