import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { rateLimit, limits } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  // 3 submissions per IP per hour
  const limited = rateLimit(req, { window: 60 * 60_000, max: 3 });
  if (limited) return limited;

  const supabase = createAdminClient();

  // Check scholarship is open
  const { data: openSetting } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'scholarship_open')
    .single();

  if (openSetting?.value !== 'true') {
    return NextResponse.json({ error: 'Scholarship applications are currently closed.' }, { status: 403 });
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const {
    name, address, phone, email, gender, age,
    school_name, grade, awards, gpa,
    us_squash_membership, club_name, tournaments,
    amount_requested, purpose,
  } = body;

  // Required field validation
  const missing: string[] = [];
  if (!name?.trim())           missing.push('Name');
  if (!address?.trim())        missing.push('Address');
  if (!email?.trim())          missing.push('Email');
  if (!age?.trim())            missing.push('Age');
  if (!school_name?.trim())    missing.push('School Name');
  if (!grade?.trim())          missing.push('Grade');
  if (!gpa?.trim())            missing.push('GPA');
  if (!club_name?.trim())      missing.push('Club Name');
  if (!amount_requested?.trim()) missing.push('Amount Requested');
  if (!purpose?.trim())        missing.push('Purpose / Need');

  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 });
  }

  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const amountNum = parseFloat(amount_requested);
  if (isNaN(amountNum) || amountNum <= 0 || amountNum > 500) {
    return NextResponse.json({ error: 'Amount must be between $1 and $500' }, { status: 400 });
  }

  // ── Build admin notification email ──────────────────────────────────────────
  function row(label: string, value: string | undefined) {
    if (!value?.trim()) return '';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top;width:200px;">${label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;vertical-align:top;">${value.replace(/\n/g, '<br/>')}</td>
    </tr>`;
  }

  function section(title: string, rows: string) {
    return `
      <tr><td colspan="2" style="padding:14px 12px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;background:#f8fafc;">${title}</td></tr>
      ${rows}`;
  }

  const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <tr>
          <td style="background:#0f172a;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">2026 Scholarship Application</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:13px;text-transform:uppercase;letter-spacing:0.08em;">New Submission</p>
          </td>
        </tr>
        <tr><td style="height:4px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899);"></td></tr>

        <tr>
          <td style="background:#ffffff;padding:8px 0 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              ${section('Contact & General', [
                row('Name', name),
                row('Address', address),
                row('Phone', phone),
                row('Email', email),
                row('Gender', gender),
                row('Age', age),
              ].join(''))}
              ${section('Education', [
                row('School Name (2025-26)', school_name),
                row('Grade', grade),
                row('Scholastic Awards', awards),
                row('GPA', gpa),
              ].join(''))}
              ${section('Squash Experience', [
                row('US Squash Membership No.', us_squash_membership),
                row('Club Name / Location', club_name),
                row('Junior Tournaments (Academic Year)', tournaments),
              ].join(''))}
              ${section('Scholarship Request', [
                row('Amount Requested', `$${amountNum.toFixed(2)}`),
                row('Purpose / Need', purpose),
              ].join(''))}
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              Submitted via seattlesquash.com · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#64748b;">
              Reply directly to this email to contact the applicant: <a href="mailto:${email}" style="color:#3b82f6;">${email}</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── Applicant confirmation email ─────────────────────────────────────────────
  const confirmHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

        <tr>
          <td style="background:#0f172a;padding:36px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:12px;">🎾</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Application Received</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.55);font-size:13px;text-transform:uppercase;letter-spacing:0.08em;">2026 Seattle Squash Scholarship</p>
          </td>
        </tr>
        <tr><td style="height:4px;background:linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899);"></td></tr>

        <tr>
          <td style="background:#ffffff;padding:40px 40px 32px;">
            <p style="margin:0 0 6px 0;font-size:20px;font-weight:700;color:#0f172a;">Thank you, ${name.trim()}!</p>
            <p style="margin:0 0 20px 0;font-size:15px;color:#475569;line-height:1.6;">
              We've received your application for the <strong style="color:#0f172a;">2026 Seattle Squash Scholarship Award</strong>.
              The SSRA scholarship committee will review all submissions and notify recipients.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:10px;margin:0 0 24px 0;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 4px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;">Amount Requested</p>
                <p style="margin:0;font-size:20px;font-weight:700;color:#0f172a;">$${amountNum.toFixed(2)}</p>
              </td></tr>
            </table>
            <p style="margin:0 0 8px 0;font-size:14px;color:#475569;line-height:1.6;">
              <strong>Important:</strong> Please email your academic transcript to
              <a href="mailto:president@seattlesquash.com" style="color:#3b82f6;">president@seattlesquash.com</a>
              to complete your application.
            </p>
            <p style="margin:0;font-size:13px;color:#94a3b8;">Questions? Reply to this email or reach us at president@seattlesquash.com.</p>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">Seattle Squash Racquets Association &nbsp;·&nbsp; P.O. Box 665, Seattle, WA 98111</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Send both emails in parallel
  const [adminResult, confirmResult] = await Promise.all([
    sendEmail({
      to: 'president@seattlesquash.com',
      subject: `Scholarship Application — ${name.trim()} (${grade}, ${school_name?.trim()})`,
      html: adminHtml,
    }),
    sendEmail({
      to: email.trim().toLowerCase(),
      subject: '2026 Seattle Squash Scholarship — Application Received',
      html: confirmHtml,
    }),
  ]);

  if (!adminResult.success) {
    console.error('[scholarship] Failed to send admin email:', adminResult.error);
    return NextResponse.json({ error: 'Failed to submit application. Please try again or email president@seattlesquash.com directly.' }, { status: 502 });
  }

  // Confirmation failure is non-blocking — application was received
  if (!confirmResult.success) {
    console.warn('[scholarship] Applicant confirmation email failed:', confirmResult.error);
  }

  return NextResponse.json({ ok: true });
}
