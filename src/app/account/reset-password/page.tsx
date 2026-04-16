'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { CheckCircle, KeyRound } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase embeds the recovery token in the URL hash.
  // We need to wait for the client to exchange it for a session.
  useEffect(() => {
    const supabase = createClient();

    // onAuthStateChange fires with SIGNED_IN (type=recovery) when
    // the user lands here via the password-reset email link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setSessionReady(true);
        }
      },
    );

    // Also check if there's already an active session (in case the
    // page is reloaded after the token was already exchanged).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push('/account'), 2500);
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Seattle Squash</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Set a new password</p>
        </div>

        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          {done ? (
            <div className="text-center py-4 space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" strokeWidth={1.5} />
              <p className="font-semibold text-[var(--text-primary)]">Password updated!</p>
              <p className="text-sm text-[var(--text-secondary)]">Redirecting to your profile…</p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center py-6">
              <div className="w-6 h-6 border-2 border-border border-t-foreground rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">Verifying reset link…</p>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                If this takes too long, the link may have expired.{' '}
                <a href="/login" className="underline text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  Request a new one.
                </a>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-5 h-5 text-[var(--text-muted)]" strokeWidth={1.5} />
                <h2 className="font-semibold text-lg text-[var(--text-primary)]">Choose a new password</h2>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Same password again"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Saving…' : 'Set Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
