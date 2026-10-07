/**
 * Password rules for client-side forms that set a password
 * (/account/set-password). Supabase Auth enforces its own minimum server-side;
 * 6 matches /login, /account and /account/reset-password. 72 is the bcrypt limit.
 */
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 72;

/** Returns an error message, or null if the new password is acceptable. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  // bcrypt truncates at 72 bytes, so measure bytes, not characters
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}
