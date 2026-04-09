'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type PageState = 'loading' | 'ready' | 'success' | 'invalid';

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Supabase processes the token hash from the URL and emits PASSWORD_RECOVERY.
    // We also check for an existing recovery session in case the page reloads.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('ready');
      } else if (event === 'SIGNED_IN') {
        // May arrive if the token was already consumed and they're signed in
        setPageState('ready');
      }
    });

    // Check if there's already a valid session (e.g. after a page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPageState('ready');
      } else {
        // No session yet — wait for the PASSWORD_RECOVERY event.
        // If the hash params are missing, show invalid after a short delay.
        const timer = setTimeout(() => {
          setPageState((s) => s === 'loading' ? 'invalid' : s);
        }, 3000);
        return () => clearTimeout(timer);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      setPageState('success');
      // Sign out so they log in fresh with the new password
      await supabase.auth.signOut();
      setTimeout(() => router.push('/login'), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Seattle Squash</h1>
          <p className="text-zinc-600 text-sm mt-1">Tournament Admin</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-6">
          {pageState === 'loading' && (
            <p className="text-sm text-zinc-600 text-center py-4">Verifying reset link…</p>
          )}

          {pageState === 'invalid' && (
            <div className="text-center space-y-3">
              <p className="text-2xl">⚠️</p>
              <p className="font-semibold">Invalid or expired link</p>
              <p className="text-sm text-zinc-600">
                This reset link has expired or already been used.
              </p>
              <Link
                href="/login"
                className="inline-block mt-2 bg-zinc-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800"
              >
                Back to sign in
              </Link>
            </div>
          )}

          {pageState === 'ready' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-semibold text-lg">Set new password</h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">New password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  autoFocus
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}

          {pageState === 'success' && (
            <div className="text-center space-y-3">
              <p className="text-2xl">✅</p>
              <p className="font-semibold">Password updated</p>
              <p className="text-sm text-zinc-600">Redirecting you to sign in…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
