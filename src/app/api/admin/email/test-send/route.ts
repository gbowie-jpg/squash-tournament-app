import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/supabase/require-role';
import { sendEmail, buildCampaignHtml, getEmailTemplateSettings } from '@/lib/email';

/**
 * POST /api/admin/email/test-send
 * Sends a one-off email to a single address.
 * No campaign record is created — useful for tests and sending to one person.
 * Body: { to: string, subject: string, body: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole('admin');
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  let payload: { to?: string; subject?: string; body?: string; attachment?: { name: string; content: string; mimeType: string } };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { to, subject, body, attachment } = payload;

  if (!to || !to.includes('@')) {
    return NextResponse.json({ error: 'A valid "to" email address is required' }, { status: 400 });
  }
  if (!subject || !body) {
    return NextResponse.json({ error: '"subject" and "body" are required' }, { status: 400 });
  }

  const template = await getEmailTemplateSettings(supabase);
  const html = buildCampaignHtml({
    body,
    tournamentName: 'Seattle Squash',
    template,
    // No unsubscribe link for manual/test sends
  });

  const result = await sendEmail({ to: to.trim().toLowerCase(), subject, html, attachment: attachment ?? undefined });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Send failed' }, { status: 502 });
  }

  return NextResponse.json({ sent: 1, to: to.trim().toLowerCase() });
}
