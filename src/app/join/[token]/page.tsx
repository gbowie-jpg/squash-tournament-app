'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const TOO_MANY = 'Too many attempts — try again in a few minutes.';
const GENERIC_RETRY = 'Something went wrong. Please try again in a few minutes.';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  // checking → valid | invalid | limited | error
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid' | 'limited' | 'error'>('checking');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Validate the token server-side (the stored token is never sent to the browser)
  useEffect(() => {
    fetch(`/api/join?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 429) { setStatus('limited'); return; }
        if (!r.ok) { setStatus('error'); return; }
        const d: { valid?: boolean } = await r.json();
        setStatus(d.valid === true ? 'valid' : 'invalid');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, firstName, lastName, email }),
      });
      if (res.status === 403) { setStatus('invalid'); return; }
      if (res.status === 429) {
        // Submit limits are per hour, so show the real wait rather than "a few minutes"
        const secs = Number(res.headers.get('Retry-After')) || 0;
        const mins = Math.max(1, Math.ceil(secs / 60));
        setError(`Too many attempts — try again in about ${mins} minute${mins === 1 ? '' : 's'}.`);
        return;
      }
      if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : GENERIC_RETRY);
        return;
      }
      if (!res.ok) { setError(GENERIC_RETRY); return; }
      setDone(true);
    } catch {
      setError(GENERIC_RETRY);
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Seattle Squash</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">You&apos;ve been invited</p>
        </div>

        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6">
          {status === 'checking' && (
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">Checking invite link…</p>
          )}

          {(status === 'limited' || status === 'error') && (
            <div className="text-center py-4">
              <h2 className="font-semibold text-[var(--text-primary)]">
                {status === 'limited' ? 'Too many attempts' : 'Couldn’t check this invite link'}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">
                {status === 'limited' ? TOO_MANY : GENERIC_RETRY}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="text-sm underline text-[var(--text-primary)]"
              >
                Try again
              </button>
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">🔗</p>
              <h2 className="font-semibold text-[var(--text-primary)]">Invalid invite link</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This link may have expired or been regenerated. Ask your admin for a new one.
              </p>
            </div>
          )}

          {status === 'valid' && !done && (
            <>
              <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-4">Create your account</h2>

              {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">First name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      autoFocus
                      autoComplete="given-name"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Last name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      autoComplete="family-name"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>

              <p className="text-center text-xs text-[var(--text-secondary)] mt-4">
                Already have an account?{' '}
                <button
                  onClick={() => router.push('/login')}
                  className="underline text-[var(--text-primary)]"
                >
                  Sign in
                </button>
              </p>
            </>
          )}

          {done && (
            <div className="text-center py-4">
              <p className="text-3xl mb-3">📬</p>
              <h2 className="font-semibold text-[var(--text-primary)]">
                Check your email to confirm your account
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">
                We sent a confirmation link to <span className="font-medium text-[var(--text-primary)]">{email}</span>.
                Open it and press <span className="font-medium text-[var(--text-primary)]">Confirm my account</span> — then you&apos;ll choose your password.
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Nothing arrived after a few minutes? Check your spam folder.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
