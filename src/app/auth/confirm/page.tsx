import type { Metadata } from 'next';
import Link from 'next/link';
import { isAllowedOtpType } from '@/lib/auth-errors';
import { isSafeRelativePath } from '@/lib/safe-redirect';
import ConfirmForm from './ConfirmForm';

/**
 * /auth/confirm?token_hash=...&type=signup[&next=/path]
 *
 * Landing PAGE for email links that carry a token_hash (account confirmation
 * links sent by /api/join). It deliberately does NOT verify the token on GET:
 * email link scanners (e.g. Microsoft Defender Safe Links) prefetch links and
 * would burn the one-time token before the person ever clicks. The token is
 * only consumed when the person presses the button, which POSTs to
 * /auth/confirm/verify.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirm your email — Seattle Squash',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | null {
  return typeof v === 'string' ? v : Array.isArray(v) ? v[0] ?? null : null;
}

export default async function ConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash);
  const type = first(params.type);
  const next = first(params.next);
  const valid = !!tokenHash && tokenHash.length <= 512 && isAllowedOtpType(type);

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Seattle Squash</h1>
        </div>

        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 text-center">
          {valid ? (
            <>
              <p className="text-3xl mb-3">✉️</p>
              <h2 className="font-semibold text-lg text-[var(--text-primary)]">Confirm your email</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 mb-5">
                {type === 'signup' || type === 'invite'
                  ? 'Press the button to confirm your email address and activate your account. You’ll choose your password next.'
                  : 'Press the button to continue.'}
              </p>
              <ConfirmForm
                tokenHash={tokenHash!}
                type={type!}
                next={isSafeRelativePath(next) ? next : null}
                label={type === 'signup' || type === 'invite' ? 'Confirm my account' : 'Continue'}
              />
            </>
          ) : (
            <>
              <p className="text-2xl mb-2">🔗</p>
              <h2 className="font-semibold text-[var(--text-primary)]">Invalid confirmation link</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">
                This link is incomplete. Try opening it again from the email, or ask an admin for a fresh invite link.
              </p>
              <Link href="/login" className="text-sm underline text-[var(--text-primary)]">
                Go to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
