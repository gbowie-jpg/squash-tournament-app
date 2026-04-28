import { NextResponse } from 'next/server';

/**
 * GET /api/email/status
 * Returns 200 if RESEND_API_KEY is configured, 503 if not.
 * Used by the admin settings page to show integration status.
 * No auth required — only reveals whether the key exists, not its value.
 */
export async function GET() {
  const configured = Boolean(process.env.RESEND_API_KEY);
  if (configured) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'RESEND_API_KEY not set' }, { status: 503 });
}
