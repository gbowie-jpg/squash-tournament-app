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
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('[email] Resend error:', JSON.stringify(err));
    console.error('[email] from:', FROM_EMAIL, '| status:', res.status);
    return { success: false, error: err.message || err.name || JSON.stringify(err) };
  }

  return { success: true };
}

export type EmailTemplateSettings = {
  heading?: string;
  subheading?: string;
  headerBg?: string;
  headerImageUrl?: string;
  footerText?: string;
};

/** Fetch email template settings from site_settings table. */
export async function getEmailTemplateSettings(
  supabase: ReturnType<typeof import('./supabase/admin').createAdminClient>,
): Promise<EmailTemplateSettings> {
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['email_heading', 'email_subheading', 'email_header_bg', 'email_header_image_url', 'email_footer_text']);

  const s: Record<string, string> = {};
  for (const row of data || []) if (row.value) s[row.key] = row.value;

  return {
    heading: s.email_heading,
    subheading: s.email_subheading,
    headerBg: s.email_header_bg,
    headerImageUrl: s.email_header_image_url,
    footerText: s.email_footer_text,
  };
}

export function buildCampaignHtml({
  body,
  tournamentName,
  unsubscribeUrl,
  template = {},
}: {
  body: string;
  tournamentName: string;
  unsubscribeUrl?: string;
  template?: EmailTemplateSettings;
}) {
  const heading = template.heading || tournamentName;
  const subheading = template.subheading || 'Seattle Squash';
  const headerBg = template.headerBg || '#1a2332';
  const footerText = template.footerText || 'Seattle Squash Racquets Association<br/>P.O. Box 665, Seattle, WA 98111';

  // Convert newlines to paragraphs; [[image:URL]] becomes an inline image
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => {
      const imageMatch = p.trim().match(/^\[\[image:(.*?)\]\]$/);
      if (imageMatch) {
        return `<p style="margin: 0 0 16px 0; text-align: center;"><img src="${imageMatch[1]}" alt="" style="max-width: 100%; height: auto; border-radius: 6px;" /></p>`;
      }
      return `<p style="margin: 0 0 16px 0; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  const headerImage = template.headerImageUrl
    ? `<img src="${template.headerImageUrl}" alt="" style="display:block; max-width: 120px; height: auto; margin: 0 auto 12px;" />`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin: 0; padding: 0; background: #f4f4f5; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: ${headerBg}; border-radius: 12px 12px 0 0; padding: 24px 32px; text-align: center;">
      ${headerImage}
      <h1 style="color: white; margin: 0; font-size: 20px;">${heading}</h1>
      <p style="color: rgba(255,255,255,0.65); margin: 4px 0 0; font-size: 13px;">${subheading}</p>
    </div>
    <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px;">
      ${paragraphs}
    </div>
    <div style="text-align: center; padding: 24px 0; color: #71717a; font-size: 12px;">
      <p>${footerText}</p>
      ${unsubscribeUrl ? `<p><a href="${unsubscribeUrl}" style="color: #71717a;">Unsubscribe</a></p>` : ''}
    </div>
  </div>
</body>
</html>`.trim();
}
