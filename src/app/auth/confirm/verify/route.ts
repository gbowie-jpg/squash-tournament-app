import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { authErrorCodeFor, isAllowedOtpType, postConfirmPath, type AuthErrorCode } from '@/lib/auth-errors';

/**
 * POST /auth/confirm/verify  (form fields: token_hash, type, next?)
 *
 * Submitted by the button on /auth/confirm. Consumes the one-time token with
 * verifyOtp() — the cookie-aware server client writes the session cookies onto
 * the redirect — then 303s to /account/set-password (signup/invite) or `next`.
 * Failures redirect to /login?error=<code>.
 *
 * POST-only on purpose: link scanners that prefetch GET URLs can't burn the token.
 *
 * For signup/invite, the account's password is replaced with a random one the
 * moment the address is proven. Any password set before that (public
 * /auth/v1/signup, the old /join) must not survive confirmation; the person
 * picks their real password next at /account/set-password.
 */

function redirectTo(path: string, origin: string) {
  // 303 so the browser follows with a GET
  return NextResponse.redirect(new URL(path, origin), 303);
}

function fail(code: AuthErrorCode, origin: string) {
  return redirectTo(`/login?error=${code}`, origin);
}

/**
 * Replace the signed-in user's password with a random one nobody knows, using
 * the user-facing PUT /auth/v1/user with the session verifyOtp just created.
 *
 * Deliberately NOT auth.admin.updateUserById: GoTrue's admin password change
 * logs the user out of ALL sessions (UpdatePassword with no session id), which
 * would kill this fresh session and break /account/set-password. The
 * user-facing update keeps the current session and ends only the others.
 * The suffix covers every character class for Auth "Password requirements".
 */
async function rotatePassword(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: randomBytes(32).toString('base64url') + 'aA1!' }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[auth/confirm/verify] password rotation failed:', res.status, body?.error_code ?? body?.code);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[auth/confirm/verify] password rotation threw:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Reject cross-site form posts (login CSRF: signing a victim into an account
 * the attacker controls). Modern browsers send Sec-Fetch-Site, which a
 * cross-site page can't forge; otherwise fall back to the Origin header, which
 * must match the host this request was made to when present.
 */
function isSameOrigin(req: NextRequest): boolean {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin' || fetchSite === 'none';
  const originHeader = req.headers.get('origin');
  if (!originHeader) return true;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return !!host && new URL(originHeader).host === host;
  } catch {
    return false; // includes Origin: null
  }
}

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);

  if (!isSameOrigin(request)) return fail('invalid_link', origin);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('invalid_link', origin);
  }

  const tokenHash = form.get('token_hash');
  const type = form.get('type');
  const next = form.get('next');

  if (typeof tokenHash !== 'string' || !tokenHash || tokenHash.length > 512 || !isAllowedOtpType(type)) {
    return fail('invalid_link', origin);
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.warn('[auth/confirm/verify] verifyOtp failed:', error.code ?? error.status);

    // Double submit: the first POST already consumed the token and signed this
    // browser in, so the second fails. A failed verifyOtp leaves the existing
    // session alone; if it belongs to an account confirmed in the last few
    // minutes, carry on to set-password. The window keeps an already-signed-in
    // user (e.g. an admin testing an old invite) from being sent to
    // set-password for their own account.
    if (type === 'signup' || type === 'invite') {
      const { data: { user } } = await supabase.auth.getUser();
      const confirmedAt = user?.email_confirmed_at ? Date.parse(user.email_confirmed_at) : NaN;
      if (user && Number.isFinite(confirmedAt) && Date.now() - confirmedAt < 10 * 60 * 1000) {
        return redirectTo('/account/set-password', origin);
      }
    }

    return fail(authErrorCodeFor(error.code), origin);
  }

  if (type === 'signup' || type === 'invite') {
    const accessToken = data.session?.access_token;
    const rotated = accessToken ? await rotatePassword(accessToken) : false;
    if (!rotated) {
      // The account is now confirmed but may still carry a password its owner
      // didn't choose. Fail safe: end the session and send them to sign in;
      // "Forgot password?" or a magic link overwrites the password.
      await supabase.auth.signOut();
      return fail('confirm_failed', origin);
    }
  }

  return redirectTo(postConfirmPath(type, typeof next === 'string' ? next : null), origin);
}

/** A GET here (old bookmark, scanner) never consumes anything — bounce to the confirm page. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL(`/auth/confirm${url.search}`, url.origin), 303);
}
