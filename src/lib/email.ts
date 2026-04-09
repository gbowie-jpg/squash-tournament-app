const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Seattle Squash <onboarding@resend.dev>';

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email send');
    return { success: false, error: 'Email not configured' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return { success: false, error: err.message || 'Send failed' };
  }

  return { success: true };
}

export function buildCampaignHtml({
  body,
  tournamentName,
  unsubscribeUrl,
}: {
  body: string;
  tournamentName: string;
  unsubscribeUrl?: string;
}) {
  // Convert newlines to paragraphs
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f4f4f5; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: #1a2332; border-radius: 12px 12px 0 0; padding: 24px 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 20px;">${tournamentName}</h1>
      <p style="color: #93c5fd; margin: 4px 0 0; font-size: 13px;">Seattle Squash</p>
    </div>
    <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px;">
      ${paragraphs}
    </div>
    <div style="text-align: center; padding: 24px 0; color: #71717a; font-size: 12px;">
      <p>Seattle Squash Racquets Association<br/>P.O. Box 665, Seattle, WA 98111</p>
      ${unsubscribeUrl ? `<p><a href="${unsubscribeUrl}" style="color: #71717a;">Unsubscribe</a></p>` : ''}
    </div>
  </div>
</body>
</html>`.trim();
}
