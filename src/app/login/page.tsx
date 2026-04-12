'use client';

import { Suspense, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setError(error.message); return; }

        // Determine redirect: use explicit param, else check role
        let dest = redirectParam || '/';
        if (!redirectParam) {
          try {
            const res = await fetch('/api/account/profile');
            if (res.ok) {
              const profile = await res.json();
              if (profile?.role === 'admin' || profile?.role === 'superadmin') {
                dest = '/admin';
              }
            }
          } catch {
            // ignore — just go to '/'
          }
        }
        router.push(dest);
        router.refresh();
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) { setError(error.message); return; }
        setMessage('Check your email for a confirmation link, then sign in.');
        setMode('signin');
      } else if (mode === 'reset') {
        const origin = window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/account/reset-password`,
        });
        if (error) { setError(error.message); return; }
        setMessage('Password reset email sent — check your inbox and click the link to set a new password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Seattle Squash</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">Tournament Admin</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg text-[var(--text-primary)]">
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h2>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg px-3 py-2 text-sm">
              {message}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {mode === 'signin' && (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={() => { setMode('reset'); setError(null); setMessage(null); }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading
              ? 'Sending…'
              : mode === 'signin'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send Reset Email'}
          </button>

          <p className="text-center text-sm text-[var(--text-secondary)]">
            {mode === 'signin' ? (
              <>
                Need an account?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="text-[var(--text-primary)] underline">
                  Sign up
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { setMode('signin'); setError(null); setMessage(null); }} className="text-[var(--text-primary)] underline">
                Back to sign in
              </button>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-zinc-600">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
