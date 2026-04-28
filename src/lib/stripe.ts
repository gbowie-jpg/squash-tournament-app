import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

/** Initialise Stripe with the secret key stored in site_settings. */
export async function getStripe(): Promise<Stripe | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ['stripe_secret_key']);

  const settings: Record<string, string> = {};
  for (const row of data || []) if (row.value) settings[row.key] = row.value;

  if (!settings.stripe_secret_key) return null;
  return new Stripe(settings.stripe_secret_key, { apiVersion: '2026-04-22.dahlia' });
}

/** Read Stripe publishable key from site_settings (safe to expose to client). */
export async function getStripePublishableKey(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'stripe_publishable_key')
    .maybeSingle();
  return data?.value ?? null;
}
