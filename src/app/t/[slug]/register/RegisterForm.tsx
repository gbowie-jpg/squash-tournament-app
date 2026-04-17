'use client';

import { useState } from 'react';
import { CheckCircle } from 'lucide-react';

const DIVISIONS = [
  { value: 'Open', label: 'Open — no rating cutoff' },
  { value: 'A', label: 'A — 5.0 or lower' },
  { value: 'B', label: 'B — 4.5 or lower' },
  { value: 'C', label: 'C — 4.0 or lower' },
  { value: 'D', label: 'D — 3.5 or lower' },
  { value: 'Other', label: 'Other (specify below)' },
];

const HOME_CLUBS = [
  'Seattle Athletic Club - Downtown',
  'Seattle Athletic Club - Northgate',
  'Pro Club Bellevue',
  'Columbia Athletic Club',
  'Washington Athletic Club (WAC)',
  'University of Washington',
  'Other',
];

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
    draw: '',
    drawOther: '',
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

    // Resolve final draw value: use typed-in value if "Other" selected
    const resolvedDraw = form.draw === 'Other' ? form.drawOther.trim() : form.draw;
    if (!resolvedDraw) {
      setError('Please select or specify a division.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, draw: resolvedDraw }),
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
        <select
          required
          value={form.draw}
          onChange={set('draw')}
          className={inputClass}
        >
          <option value="" disabled>Select a division…</option>
          {DIVISIONS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        {form.draw === 'Other' && (
          <input
            type="text"
            value={form.drawOther}
            onChange={set('drawOther')}
            placeholder="Describe your division…"
            className={`${inputClass} mt-2`}
            autoFocus
          />
        )}
      </div>

      {/* Home Club */}
      <div>
        <label className={labelClass}>Home Club</label>
        <select
          value={form.club}
          onChange={set('club')}
          className={inputClass}
        >
          <option value="">Select your club…</option>
          {HOME_CLUBS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
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
