'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '@/lib/password-rules';

/**
 * /account/set-password — final step of invite-only sign-up.
 *
 * /auth/confirm/verify lands new accounts here once they've proven they own the
 * email. Verify replaces the account's password with a random one at that
 * moment (any earlier password was set before the address was proven), so this
 * is where the person picks their real one (and can fix their name).
 * Password resets keep using /account/reset-password.
 */

const MAX_NAME_LENGTH = 100;

export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'signedOut' | 'ready'>('loading');
  const [fullName, setFullName] = useState('');
  const [initialName, setInitialName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setStatus('signedOut'); return; }
      let name = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
      try {
        const res = await fetch('/api/account/profile', { cache: 'no-store' });
        if (res.ok) {
          const p: { full_name?: string | null } = await res.json();
          if (p?.full_name) name = p.full_name;
        }
      } catch {
        // fall back to the name from sign-up metadata
      }
      setFullName(name);
      setInitialName(name);
      setStatus('ready');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = fullName.trim();
    if (!name) { setError('Please enter your name.'); return; }
    if (name.length > MAX_NAME_LENGTH) { setError(`Name must be at most ${MAX_NAME_LENGTH} characters.`); return; }
    const pwError = validateNewPassword(password, confirm);
    if (pwError) { setError(pwError); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError(updateError.message); return; }

      if (name !== initialName.trim()) {
        const res = await fetch('/api/account/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: name }),
        });
        if (!res.ok) {
          // Password is set; the name can be fixed later on /account
          setError('Your password is set, but we couldn’t save your name. You can update it on your account page.');
          setPassword('');
          setConfirm('');
          setTimeout(() => router.push('/account'), 3000);
          return;
        }
      }

      setPassword('');
      setConfirm('');
      setDone(true);
      setTimeout(() => router.push('/account'), 1500);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Seattle Squash</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Finish setting up your account</p>
        </div>

        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          {status === 'loading' ? (
            <div className="text-center py-6">
              <div className="w-6 h-6 border-2 border-[var(--border)] border-t-[var(--text-primary)] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
            </div>
          ) : status === 'signedOut' ? (
            <div className="text-center py-4">
              <h2 className="font-semibold text-[var(--text-primary)]">You&apos;re not signed in</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">
                Sign in to set your password. If you just confirmed your email and ended up here, the link may have expired — use a magic link or “Forgot password?” on the sign-in page.
              </p>
              <Link href="/login" className="text-sm underline text-[var(--text-primary)]">
                Go to sign in
              </Link>
            </div>
          ) : done ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" strokeWidth={1.5} />
              <p className="font-semibold text-[var(--text-primary)]">You&apos;re all set!</p>
              <p className="text-sm text-[var(--text-secondary)]">Taking you to your account…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-5 h-5 text-[var(--text-muted)]" strokeWidth={1.5} />
                <h2 className="font-semibold text-lg text-[var(--text-primary)]">Email confirmed</h2>
              </div>
              <p className="text-sm text-[var(--text-secondary)] -mt-2">
                Check your name and choose a password to finish.
              </p>

              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Your name</label>
                <input
                  type="text"
                  required
                  maxLength={MAX_NAME_LENGTH}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Choose a password</label>
                <input
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Same password again"
                  autoComplete="new-password"
                  className={inputCls}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : 'Set Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
