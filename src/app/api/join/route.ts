import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, rateLimitKey } from '@/lib/rateLimit';
import { inviteTokenMatches } from '@/lib/invite-token';
import { sendEmail, getEmailTemplateSettings, buildAccountEmailHtml } from '@/lib/email';

/**
 * Invite-only account sign-up.
 *
 * Public sign-up is disabled in Supabase Auth; the only way to create an
 * account is the shared invite link /join/[token] (token lives in
 * site_settings.invite_token, managed by /api/admin/invite-link).
 *
 * Accounts are created UNCONFIRMED via auth.admin.generateLink({ type: 'signup' })
 * with a random throwaway password nobody knows, and we email the confirmation
 * link ourselves. The person clicks it (→ /auth/confirm page → button →
 * /auth/confirm/verify, which replaces the password again once the address is
 * proven) and only then chooses a password at /account/set-password — so
 * nobody can set a usable password for an address they don't control.
 *
 * Retries for an existing UNCONFIRMED user:
 *   - The pending account's password is first reset to a fresh random value.
 *     generateLink never touches an existing user's password, so a password
 *     set before the address was proven (public /auth/v1/signup, the old
 *     /join) would otherwise survive confirmation. This has to happen BEFORE
 *     generateLink: an admin password change clears the confirmation token.
 *   - generateLink is called WITHOUT options.data, because GoTrue MERGES
 *     options.data into an existing unconfirmed user's metadata — sending the
 *     submitted name would let anyone with the invite link rename someone
 *     else's pending sign-up. The stored name is left alone.
 *   - The call still issues a new confirmation token, which invalidates any
 *     earlier confirmation link (expected for a resend). A per-address limit
 *     caps how often that can happen.
 * Confirmed users are never changed here: generateLink returns email_exists.
 */

const INVALID_INVITE = 'This invite link is invalid or has been replaced. Ask an admin for a new one.';
const GENERIC_ERROR = 'Something went wrong. Please try again in a few minutes.';
const MAX_NAME_LENGTH = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fixed buckets: the key is caller IP + bucket name only. The submit cap is
// generous because on tournament day everyone at the venue shares one Wi-Fi
// IP; the per-address cap below is what stops repeated resends to one person.
const CHECK_LIMIT = { window: 10 * 60_000, max: 30, bucket: 'join-check' };
const SUBMIT_IP_LIMIT = { window: 60 * 60_000, max: 30, bucket: 'join-submit' };
const SUBMIT_EMAIL_LIMIT = { window: 60 * 60_000, max: 3 };

/**
 * Throwaway password: never stored or shown. The fixed suffix covers every
 * character class so it passes any Supabase Auth "Password requirements"
 * setting (base64url alone has no symbol ~25% of the time). 47 bytes, under
 * bcrypt's 72-byte limit; the 256 random bits are what matter.
 */
function throwawayPassword() {
  return randomBytes(32).toString('base64url') + 'aA1!';
}

type InviteCheck = 'valid' | 'invalid' | 'unavailable';

/**
 * 'unavailable' means the lookup itself failed (DB/network/config), so the
 * caller answers 503 instead of telling the person their link is invalid.
 * A missing invite_token row is 'invalid': no token configured, no valid link.
 */
async function checkInvite(token: unknown): Promise<InviteCheck> {
  if (typeof token !== 'string' || token.length === 0) return 'invalid';
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'invite_token')
      .maybeSingle();
    if (error) {
      console.error('[join] Failed to read invite token:', error.message);
      return 'unavailable';
    }
    return inviteTokenMatches(token, data?.value) ? 'valid' : 'invalid';
  } catch (err) {
    console.error('[join] Invite token lookup threw:', err instanceof Error ? err.message : err);
    return 'unavailable';
  }
}

function siteUrlFor(req: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || new URL(req.url).origin).replace(/\/+$/, '');
}

/** GET /api/join?token= — lets the join page show the invalid-link state up front. */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, CHECK_LIMIT);
  if (limited) return limited;

  const token = req.nextUrl.searchParams.get('token');
  const result = await checkInvite(token);
  if (result === 'unavailable') {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ valid: result === 'valid' }, { headers: { 'Cache-Control': 'no-store' } });
}

/** POST /api/join — { token, firstName, lastName, email } */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, SUBMIT_IP_LIMIT);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { token, firstName, lastName, email } = body;

  const invite = await checkInvite(token);
  if (invite === 'unavailable') {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 503 });
  }
  if (invite !== 'valid') {
    return NextResponse.json({ error: INVALID_INVITE }, { status: 403 });
  }

  if (typeof firstName !== 'string' || !firstName.trim() || firstName.trim().length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: 'First name is required' }, { status: 400 });
  }
  if (typeof lastName !== 'string' || !lastName.trim() || lastName.trim().length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
  }
  if (typeof email !== 'string' || email.trim().length > 254 || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const fullName = `${firstName.trim()} ${lastName.trim()}`;
  const siteUrl = siteUrlFor(req);

  // Per-address cap (only well-formed, valid-invite submits count). Keyed by a
  // hash so addresses aren't held in memory. Applies whether or not an account
  // exists, so hitting it reveals nothing about the address.
  const emailKey = createHash('sha256').update(normalizedEmail).digest('base64url');
  const emailLimited = rateLimitKey(`join-submit-email:${emailKey}`, SUBMIT_EMAIL_LIMIT);
  if (emailLimited) return emailLimited;

  const supabase = createAdminClient();

  // Existing account? profiles.email is copied from auth.users.email (already
  // lowercase) by the on_auth_user_created trigger. A missing row (trigger gap
  // or race) falls through to the new-user path, as before.
  const { data: existingProfile, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (lookupError) {
    console.error('[join] Profile lookup failed:', lookupError.message);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  if (existingProfile) {
    const { data: existing, error: getUserError } = await supabase.auth.admin.getUserById(existingProfile.id);
    // user_not_found = orphaned profile row; nothing to reset, carry on.
    if (getUserError && getUserError.code !== 'user_not_found') {
      console.error('[join] getUserById failed:', getUserError.code, getUserError.status, getUserError.message);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }
    // Pending (unconfirmed) account: replace whatever password it was created
    // with, so only the confirmed owner can ever set a usable one. Must run
    // BEFORE generateLink — an admin password change clears the confirmation
    // token. Never done for confirmed users (would lock out a real account).
    // Pass only `password`: no email_confirm, no metadata — it stays unconfirmed.
    if (existing?.user && !existing.user.email_confirmed_at) {
      const { error: pwError } = await supabase.auth.admin.updateUserById(existing.user.id, {
        password: throwawayPassword(),
      });
      if (pwError) {
        console.error('[join] Failed to reset pending password:', pwError.code, pwError.status, pwError.message);
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
      }
    }
  }

  const template = await getEmailTemplateSettings(supabase);

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email: normalizedEmail,
    // Only used when this call creates the user; generateLink ignores it for
    // an existing one (handled above).
    password: throwawayPassword(),
    // Metadata only on create: for an existing unconfirmed user GoTrue MERGES
    // options.data into user_metadata.
    ...(existingProfile ? {} : { options: { data: { full_name: fullName } } }),
  });

  let html: string;
  let subject: string;

  if (error) {
    const alreadyExists =
      error.code === 'email_exists' ||
      error.code === 'user_already_exists' ||
      /already (been )?registered|already exists/i.test(error.message);

    if (!alreadyExists) {
      if (error.code === 'weak_password') {
        console.error('[join] generateLink rejected the throwaway password — check Auth "Password requirements":', error.message);
      } else {
        console.error('[join] generateLink failed:', error.code, error.status, error.message);
      }
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
    }

    // Confirmed account already exists. Respond exactly like a new sign-up (no
    // account enumeration) and tell the address owner how to get back in.
    subject = 'You already have a Seattle Squash account';
    html = buildAccountEmailHtml({
      subheading: 'Account',
      paragraphs: [
        'Someone (hopefully you) tried to create a Seattle Squash account with this email address, but you already have one.',
        'Sign in with your existing password, or use <strong style="color:#0f172a;">Forgot password?</strong> on the sign-in page to set a new one.',
      ],
      buttonLabel: 'Sign In',
      buttonUrl: `${siteUrl}/login`,
      finePrint: 'If this wasn&#39;t you, you can ignore this email — nothing has changed on your account.',
      template,
    });
  } else {
    // Greet only a user this request just created, with the name just
    // submitted. For an existing account (pending or not) no name is used:
    // whatever is stored may have been typed by someone else, and
    // data.user.user_metadata is never trusted for this.
    const { properties, user } = data;
    const createdAt = user?.created_at ? Date.parse(user.created_at) : NaN;
    const justCreated = !existingProfile && Number.isFinite(createdAt) && Date.now() - createdAt < 60_000;
    const greetingName = justCreated ? firstName.trim().split(/\s+/)[0] : null;

    // Lands on a page with a button — the token is only consumed on POST, so
    // email link scanners that prefetch GET URLs can't burn it.
    const confirmUrl =
      `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(properties.hashed_token)}&type=signup`;

    subject = 'Confirm your Seattle Squash account';
    html = buildAccountEmailHtml({
      subheading: 'Confirm your email',
      greetingName,
      paragraphs: [
        'Thanks for joining Seattle Squash. Please confirm your email address to activate your account — you&#39;ll choose your password right after.',
      ],
      buttonLabel: 'Confirm my account',
      buttonUrl: confirmUrl,
      finePrint: 'If you didn&#39;t request this, you can ignore this email — the account won&#39;t be activated.',
      template,
    });
  }

  const sent = await sendEmail({ to: normalizedEmail, subject, html });
  if (!sent.success) {
    console.error('[join] Failed to send email:', sent.error);
    return NextResponse.json(
      { error: 'We couldn’t send the confirmation email. Please try again in a few minutes.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
