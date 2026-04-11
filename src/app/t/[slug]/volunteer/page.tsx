'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTournament } from '@/lib/useTournament';
import { ChevronLeft, Flag, HandHelping, User, CheckCircle } from 'lucide-react';
import TournamentBottomNav from '@/components/layout/TournamentBottomNav';
import ThemeToggle from '@/components/ThemeToggle';

const ROLES = [
  {
    value: 'referee',
    label: 'Referee',
    desc: 'Officiate matches',
    Icon: Flag,
  },
  {
    value: 'volunteer',
    label: 'Volunteer',
    desc: 'General tournament help',
    Icon: HandHelping,
  },
  {
    value: 'helper',
    label: 'Available',
    desc: 'Available if needed',
    Icon: User,
  },
];

export default function VolunteerSignup({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { tournament, loading } = useTournament(slug);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'referee',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/volunteers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to sign up');
        return;
      }

      // Sign in with the new account
      const supabase = createClient();
      await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      setSubmitted(true);
      setTimeout(() => {
        router.push(`/t/${slug}`);
        router.refresh();
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">
        Loading…
      </div>
    );
  }
  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">
        Not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-20 md:pb-0">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-start justify-between">
          <div>
            <Link
              href={`/t/${slug}`}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 mb-0.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {tournament.name}
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Volunteer / Referee Signup
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {submitted ? (
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" strokeWidth={1.5} />
            <h2 className="text-xl font-bold text-[var(--text-primary)]">You&apos;re signed up!</h2>
            <p className="text-[var(--text-secondary)] mt-2">
              Your account has been created. Redirecting to the tournament&hellip;
            </p>
            <Link
              href={`/t/${slug}`}
              className="inline-block mt-6 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Go to Tournament
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-6 space-y-5"
          >
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your full name"
                className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[var(--text-muted)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 6 characters"
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[var(--text-muted)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[var(--text-muted)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                How would you like to help? <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {ROLES.map(({ value, label, desc, Icon }) => (
                  <label
                    key={value}
                    className={`p-3 rounded-xl border cursor-pointer text-center transition-colors ${
                      form.role === value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-500'
                        : 'border-[var(--border)] hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={value}
                      checked={form.role === value}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="sr-only"
                    />
                    <Icon
                      className={`w-5 h-5 mx-auto mb-1 ${
                        form.role === value
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-[var(--text-muted)]'
                      }`}
                      strokeWidth={1.5}
                    />
                    <div className={`text-sm font-medium ${form.role === value ? 'text-blue-700 dark:text-blue-300' : 'text-[var(--text-primary)]'}`}>
                      {label}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">{desc}</div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Availability, experience, etc."
                className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[var(--text-muted)]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? 'Creating account…' : 'Sign Up & Create Account'}
            </button>

            <p className="text-center text-sm text-[var(--text-secondary)]">
              Already have an account?{' '}
              <Link
                href={`/login?redirect=/t/${slug}`}
                className="text-[var(--text-primary)] underline underline-offset-2"
              >
                Sign in
              </Link>
            </p>
          </form>
        )}
      </main>

      <TournamentBottomNav slug={slug} />
    </div>
  );
}
