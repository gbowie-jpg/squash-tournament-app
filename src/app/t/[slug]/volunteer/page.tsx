'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';

export default function VolunteerSignup({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading } = useTournament(slug);

  const [form, setForm] = useState({
    name: '',
    email: '',
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
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-zinc-400">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-zinc-400">Not found</div>;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <Link href={`/t/${slug}`} className="text-sm text-zinc-400 hover:text-zinc-600">
            &larr; {tournament.name}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Volunteer / Referee Signup</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Help make {tournament.name} a great event
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {submitted ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-bold">Thanks for signing up!</h2>
            <p className="text-zinc-400 mt-2">
              The tournament organizers will be in touch if needed. You may be assigned to referee specific matches.
            </p>
            <Link
              href={`/t/${slug}`}
              className="inline-block mt-6 bg-zinc-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800"
            >
              Back to Tournament
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your full name"
                className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">How would you like to help? *</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: 'referee', label: '🏁 Referee', desc: 'Officiate matches' },
                  { value: 'volunteer', label: '🤝 Volunteer', desc: 'General tournament help' },
                  { value: 'helper', label: '🙋 Available', desc: 'Available if needed' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`p-3 rounded-lg border cursor-pointer text-center transition-colors ${
                      form.role === opt.value
                        ? 'border-zinc-900 bg-zinc-50'
                        : 'border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={opt.value}
                      checked={form.role === opt.value}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-lg">{opt.label.split(' ')[0]}</div>
                    <div className="text-sm font-medium mt-1">{opt.label.split(' ').slice(1).join(' ')}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{opt.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Availability, experience, etc."
                className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-zinc-900 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Signing up...' : 'Sign Up'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
