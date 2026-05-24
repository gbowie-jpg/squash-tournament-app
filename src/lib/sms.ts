import twilio from 'twilio';
import { createAdminClient } from '@/lib/supabase/admin';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const FROM = process.env.TWILIO_FROM_NUMBER!;

/** Normalize to E.164. Handles 10-digit US numbers and already-formatted ones. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 11) return `+${digits}`; // international
  return null;
}

/**
 * Broadcast an SMS to all profiles that have opted in with a phone number.
 * Fire-and-forget safe — errors are caught per-number.
 */
export async function sendSmsToAll(body: string): Promise<{ sent: number; failed: number }> {
  const supabase = createAdminClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('phone')
    .not('phone', 'is', null);

  if (!profiles || profiles.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    profiles.map(async (p) => {
      const to = normalizePhone(p.phone!);
      if (!to) { failed++; return; }
      try {
        await client.messages.create({ from: FROM, to, body });
        sent++;
      } catch {
        failed++;
      }
    }),
  );

  return { sent, failed };
}
