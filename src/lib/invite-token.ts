import { timingSafeEqual } from 'crypto';

/**
 * Constant-time comparison of a caller-supplied invite token against the stored
 * one. Missing/empty/oversized values never match. Server-only (node crypto).
 */
export function inviteTokenMatches(provided: unknown, stored: unknown): boolean {
  if (typeof provided !== 'string' || typeof stored !== 'string') return false;
  if (provided.length === 0 || stored.length === 0 || provided.length > 256) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(stored, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
