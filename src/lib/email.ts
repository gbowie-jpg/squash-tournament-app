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

/**
 * Shared base layout used for both campaign and transactional emails.
 * Produces a full HTML document with header, accent bar, body, and footer.
 */
function baseLayout({
  headerBg,
  headerImageUrl,
  heading,
  subheading,
  bodyHtml,
  footerHtml,
}: {
  headerBg: string;
  headerImageUrl?: string;
  heading: string;
  subheading: string;
  bodyHtml: string;
  footerHtml: string;
}) {
  const logo = headerImageUrl
    ? `<img src="${headerImageUrl}" alt="${heading}" style="display:block;max-width:100px;height:auto;margin:0 auto 14px;border-radius:12px;" />`
    : `<div style="display:inline-block;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.15);margin:0 auto 14px;font-size:24px;line-height:48px;text-align:center;">🎾</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:${headerBg};padding:36px 40px;text-align:center;">
            ${logo}
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.01em;line-height:1.3;">${heading}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;">${subheading}</p>
          </td>
        </tr>

        <!-- Accent bar -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899);"></td></tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:40px 40px 32px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            ${footerHtml}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

/** Registration confirmation email. */
export function buildRegistrationHtml({
  playerName,
  tournamentName,
  tournamentUrl,
  playerPageUrl,
  draw,
  club,
  template = {},
}: {
  playerName: string;
  tournamentName: string;
  tournamentUrl: string;
  playerPageUrl: string;
  draw?: string | null;
  club?: string | null;
  template?: EmailTemplateSettings;
}) {
  const headerBg = template.headerBg || '#0f172a';
  const heading   = template.heading  || tournamentName;
  const footerText = template.footerText || 'Seattle Squash Racquets Association &nbsp;·&nbsp; P.O. Box 665, Seattle, WA 98111';

  const detailRows = [
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;white-space:nowrap;">Name</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${playerName}</td></tr>`,
    draw ? `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;white-space:nowrap;">Division</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600;">${draw}</td></tr>` : '',
    club ? `<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;white-space:nowrap;">Club</td><td style="padding:8px 12px;font-size:13px;color:#0f172a;font-weight:600;">${club}</td></tr>` : '',
  ].join('');

  const bodyHtml = `
    <p style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0f172a;">You're in! 🎉</p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#475569;line-height:1.6;">Hi ${playerName}, your registration for <strong style="color:#0f172a;">${tournamentName}</strong> is confirmed.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 28px 0;">
      ${detailRows}
    </table>

    <p style="margin:0 0 16px 0;font-size:14px;color:#475569;line-height:1.6;">Check the draw, follow live scores, and track your results on the tournament page:</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
      <tr><td align="center">
        <a href="${tournamentUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.01em;">View Tournament →</a>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;">Your Player Page</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#475569;">Bookmark this link to track your matches and results:</p>
          <p style="margin:6px 0 0;"><a href="${playerPageUrl}" style="color:#3b82f6;font-size:13px;word-break:break-all;">${playerPageUrl}</a></p>
        </td>
      </tr>
    </table>`;

  const footerHtml = `<p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">${footerText}</p>`;

  return baseLayout({
    headerBg,
    headerImageUrl: template.headerImageUrl,
    heading,
    subheading: 'Registration Confirmed',
    bodyHtml,
    footerHtml,
  });
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
  const heading    = template.heading    || tournamentName;
  const subheading = template.subheading || 'Seattle Squash';
  const headerBg   = template.headerBg   || '#0f172a';
  const footerText = template.footerText || 'Seattle Squash Racquets Association &nbsp;·&nbsp; P.O. Box 665, Seattle, WA 98111';

  // Convert newlines → paragraphs; [[image:URL]] → inline image; [[button:Label|URL]] → CTA
  const paragraphs = body
    .split(/\n\n+/)
    .map((p) => {
      const imageMatch = p.trim().match(/^\[\[image:(.*?)\]\]$/);
      if (imageMatch) {
        return `<p style="margin:0 0 20px 0;text-align:center;"><img src="${imageMatch[1]}" alt="" style="max-width:100%;height:auto;border-radius:8px;" /></p>`;
      }
      const btnMatch = p.trim().match(/^\[\[button:(.*?)\|(.*?)\]\]$/);
      if (btnMatch) {
        return `<p style="margin:0 0 24px 0;text-align:center;"><a href="${btnMatch[2]}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.01em;">${btnMatch[1]}</a></p>`;
      }
      return `<p style="margin:0 0 18px 0;line-height:1.7;color:#1e293b;">${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  const footerHtml = `
    <p style="margin:0 0 6px;color:#64748b;font-size:12px;line-height:1.6;">${footerText}</p>
    ${unsubscribeUrl ? `<p style="margin:0;font-size:11px;"><a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe from these emails</a></p>` : ''}`;

  return baseLayout({
    headerBg,
    headerImageUrl: template.headerImageUrl,
    heading,
    subheading,
    bodyHtml: paragraphs,
    footerHtml,
  });
}
