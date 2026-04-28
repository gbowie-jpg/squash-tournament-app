'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [valid, setValid] = useState<boolean | null>(null); // null = checking
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Validate the token against the stored one
  useEffect(() => {
    fetch('/api/site-settings')
      .then((r) => r.json())
      .then((settings) => {
        setValid(settings.invite_token === token);
      })
      .catch(() => setValid(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (signUpError) { setError(signUpError.message); return; }
      setDone(true);
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
          {valid === null && (
            <p className="text-sm text-[var(--text-secondary)] text-center py-4">Checking invite link…</p>
          )}

          {valid === false && (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">🔗</p>
              <h2 className="font-semibold text-[var(--text-primary)]">Invalid invite link</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                This link may have expired or been regenerated. Ask your admin for a new one.
              </p>
            </div>
          )}

          {valid === true && !done && (
            <>
              <h2 className="font-semibold text-lg text-[var(--text-primary)] mb-4">Create your account</h2>

              {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Full name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    autoFocus
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6+ characters"
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
              <p className="text-3xl mb-3">🎉</p>
              <h2 className="font-semibold text-[var(--text-primary)]">Account created!</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 mb-4">
                Check your email for a confirmation link, then sign in.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Go to sign in →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
