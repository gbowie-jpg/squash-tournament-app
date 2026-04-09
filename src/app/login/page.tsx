'use client';

import { Suspense, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/admin';
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
        router.push(redirectTo);
        router.refresh();
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) { setError(error.message); return; }
        setMessage('Check your email for a confirmation link, then sign in.');
        setMode('signin');
      } else if (mode === 'magic') {
        const origin = window.location.origin;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${origin}${redirectTo}` },
        });
        if (error) { setError(error.message); return; }
        setMessage('Magic link sent — check your inbox and click the link to sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Seattle Squash</h1>
          <p className="text-zinc-600 text-sm mt-1">Tournament Admin</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Email me a sign-in link'}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm">
              {message}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          {mode !== 'magic' && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          )}

          {mode === 'signin' && (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={() => { setMode('magic'); setError(null); setMessage(null); }}
                className="text-xs text-zinc-500 hover:text-zinc-700 underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {loading
              ? 'Sending…'
              : mode === 'signin'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send magic link'}
          </button>

          <p className="text-center text-sm text-zinc-600">
            {mode === 'signin' ? (
              <>
                Need an account?{' '}
                <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="text-zinc-900 underline">
                  Sign up
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { setMode('signin'); setError(null); setMessage(null); }} className="text-zinc-900 underline">
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
