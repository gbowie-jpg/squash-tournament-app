import type { EmailOtpType } from '@supabase/supabase-js';
import { safeRelativePath } from './safe-redirect';

/**
 * Pure helpers shared by the auth landing routes (/auth/callback,
 * /auth/confirm/verify) and /login.
 *
 * The routes only ever put a short code in /login?error=<code>; /login maps it
 * to fixed copy and ignores anything it doesn't recognise, so nobody can make
 * the sign-in page display attacker-chosen text.
 *
 * No server-only imports — safe for client components.
 */

export const AUTH_ERROR_MESSAGES = {
  invalid_link:
    'That link is invalid or incomplete. Try opening it again from the email, or ask an admin for a fresh invite link.',
  link_expired:
    'That link has expired or has already been used. If your account is already confirmed, sign in below — or use “Forgot password?” or a magic link.',
  confirm_failed:
    'We couldn’t confirm your email. The link may have expired or already been used. Try signing in, or ask an admin for a fresh invite link.',
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERROR_MESSAGES;

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, value);
}

/** Friendly message for a known ?error= code; null for missing/unknown codes. */
export function authErrorMessage(code: string | null | undefined): string | null {
  return isAuthErrorCode(code) ? AUTH_ERROR_MESSAGES[code] : null;
}

/** Maps a Supabase auth error code to one of our /login codes. */
export function authErrorCodeFor(supabaseCode: string | null | undefined): AuthErrorCode {
  switch (supabaseCode) {
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return 'link_expired';
    default:
      return 'confirm_failed';
  }
}

/** Email OTP types accepted on /auth/confirm. */
export const ALLOWED_OTP_TYPES: readonly EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email'];

export function isAllowedOtpType(type: unknown): type is EmailOtpType {
  return typeof type === 'string' && (ALLOWED_OTP_TYPES as readonly string[]).includes(type);
}

/**
 * Where to send someone after a successful email confirmation. New accounts
 * (signup/invite) were created with a throwaway password, so they always go
 * to /account/set-password; other types honour a safe relative `next`.
 */
export function postConfirmPath(type: EmailOtpType, next: string | null | undefined): string {
  if (type === 'signup' || type === 'invite') return '/account/set-password';
  return safeRelativePath(next, '/');
}
