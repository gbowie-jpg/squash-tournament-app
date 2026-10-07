/**
 * site_settings key allowlists. No imports — safe for client and server.
 *
 * PUBLIC keys are returned by GET /api/site-settings (anyone can read them).
 * WRITE_ONLY keys can be saved by admins via PATCH but are never returned.
 * Any key in neither list (e.g. invite_token) can't be read or written through
 * /api/site-settings at all — it is managed by its own server route.
 *
 * Adding a new setting? Add its key here or the admin page that saves it will
 * get a 400 and the public page that reads it will see nothing.
 */

/** Homepage hero (read by src/app/page.tsx, edited in /admin/content). */
export const HOMEPAGE_SETTING_KEYS = [
  'homepage_hero_image',
  'homepage_hero_gradient',
  'homepage_hero_overlay',
  'homepage_hero_text_color',
  'homepage_hero_title',
  'homepage_hero_subtitle',
  'homepage_cta1_label',
  'homepage_cta1_href',
  'homepage_cta2_label',
  'homepage_cta2_href',
] as const;

/** Scholarship page (read by src/app/scholarship, edited in /admin/settings). */
export const SCHOLARSHIP_SETTING_KEYS = [
  'scholarship_open',
  'scholarship_hero_gradient',
  'scholarship_hero_text_color',
  'scholarship_hero_image_url',
  'scholarship_hero_overlay',
  'scholarship_hero_subtitle',
] as const;

/** Email header/footer template (read by src/lib/email.ts, edited in /admin/settings and /admin/email). */
export const EMAIL_TEMPLATE_SETTING_KEYS = [
  'email_heading',
  'email_subheading',
  'email_header_bg',
  'email_header_image_url',
  'email_footer_text',
] as const;

/** Readable by anyone via GET /api/site-settings; writable by admins via PATCH. */
export const PUBLIC_SETTING_KEYS = [
  ...HOMEPAGE_SETTING_KEYS,
  ...SCHOLARSHIP_SETTING_KEYS,
  'sponsor_splash_duration_ms',
  ...EMAIL_TEMPLATE_SETTING_KEYS,
  'stripe_publishable_key',
] as const;

/** Writable by admins via PATCH, never returned by GET. */
export const WRITE_ONLY_SETTING_KEYS = [
  'stripe_secret_key',
  'stripe_webhook_secret',
] as const;

export type PublicSettingKey = (typeof PUBLIC_SETTING_KEYS)[number];
export type WriteOnlySettingKey = (typeof WRITE_ONLY_SETTING_KEYS)[number];
export type WritableSettingKey = PublicSettingKey | WriteOnlySettingKey;

const PUBLIC_SET: ReadonlySet<string> = new Set(PUBLIC_SETTING_KEYS);
const WRITABLE_SET: ReadonlySet<string> = new Set([...PUBLIC_SETTING_KEYS, ...WRITE_ONLY_SETTING_KEYS]);

export function isPublicSettingKey(key: string): key is PublicSettingKey {
  return PUBLIC_SET.has(key);
}

export function isWritableSettingKey(key: string): key is WritableSettingKey {
  return WRITABLE_SET.has(key);
}

export type SettingsPatchResult =
  | { ok: true; values: Partial<Record<WritableSettingKey, string | null>> }
  | { ok: false; error: string };

/**
 * Validate a PATCH body for /api/site-settings.
 * Must be a plain object whose keys are all writable and whose values are
 * strings or null. Empty strings are normalised to null.
 */
export function validateSettingsPatch(body: unknown): SettingsPatchResult {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const proto = Object.getPrototypeOf(body);
  if (proto !== Object.prototype && proto !== null) {
    return { ok: false, error: 'Body must be a JSON object' };
  }

  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length === 0) {
    return { ok: false, error: 'No settings provided' };
  }

  const unknownKeys = entries.map(([k]) => k).filter((k) => !isWritableSettingKey(k));
  if (unknownKeys.length > 0) {
    return { ok: false, error: `Unknown setting: ${unknownKeys.join(', ')}` };
  }

  const values: Partial<Record<WritableSettingKey, string | null>> = {};
  for (const [key, value] of entries) {
    if (value !== null && typeof value !== 'string') {
      return { ok: false, error: `Setting ${key} must be a string or null` };
    }
    values[key as WritableSettingKey] = value === '' ? null : value;
  }
  return { ok: true, values };
}
