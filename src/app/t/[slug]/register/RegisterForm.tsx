'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface Props {
  tournamentId: string;
  tournamentSlug: string;
  draws: string[];
}

export default function RegisterForm({ tournamentId, tournamentSlug, draws }: Props) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    draw: draws.length > 0 ? draws[0] : '',
    club: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-[var(--text-muted)]';
  const labelClass = 'block text-sm font-medium text-[var(--text-primary)] mb-1';

  if (submitted) {
    return (
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" strokeWidth={1.5} />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          ✓ You&apos;re registered!
        </h2>
        <p className="text-[var(--text-secondary)] mt-2">
          We&apos;ll be in touch with details.
        </p>
        <a
          href={`/t/${tournamentSlug}`}
          className="inline-block mt-6 bg-foreground text-card px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Back to Tournament
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-6 space-y-5"
    >
      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Full Name */}
      <div>
        <label className={labelClass}>
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          required
          type="text"
          value={form.name}
          onChange={set('name')}
          placeholder="Your full name"
          className={inputClass}
        />
      </div>

      {/* Email + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            Email <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={set('phone')}
            placeholder="(555) 123-4567"
            className={inputClass}
          />
        </div>
      </div>

      {/* Division / Draw */}
      <div>
        <label className={labelClass}>
          Division / Draw <span className="text-red-500">*</span>
        </label>
        {draws.length > 0 ? (
          <select
            required
            value={form.draw}
            onChange={set('draw')}
            className={inputClass}
          >
            <option value="" disabled>
              Select a division…
            </option>
            {draws.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        ) : (
          <input
            required
            type="text"
            value={form.draw}
            onChange={set('draw')}
            placeholder="e.g. Men's A, Women's B"
            className={inputClass}
          />
        )}
      </div>

      {/* Club */}
      <div>
        <label className={labelClass}>Club / Home Club</label>
        <input
          type="text"
          value={form.club}
          onChange={set('club')}
          placeholder="Your squash club"
          className={inputClass}
        />
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes for Organizer</label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={3}
          placeholder="Anything the organizer should know…"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-foreground text-card px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {submitting ? 'Registering…' : 'Register'}
      </button>
    </form>
  );
}
