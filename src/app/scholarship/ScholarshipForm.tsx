'use client';

import { useState } from 'react';

type Field = {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'number' | 'select' | 'textarea';
  placeholder?: string;
  required?: boolean;
  options?: string[];
  hint?: string;
  min?: number;
  max?: number;
  rows?: number;
};

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: 'Contact & General Information',
    fields: [
      { id: 'name',    label: 'Full Name',     required: true,  placeholder: 'Your full name' },
      { id: 'address', label: 'Address',        required: true,  placeholder: 'Street, City, State, ZIP' },
      { id: 'phone',   label: 'Phone Number',   type: 'tel',     placeholder: '(206) 555-0100' },
      { id: 'email',   label: 'Email Address',  type: 'email',   required: true, placeholder: 'you@example.com' },
      {
        id: 'gender', label: 'Gender', type: 'select',
        options: ['', 'Male', 'Female', 'Non-binary', 'Prefer not to say'],
      },
      { id: 'age', label: 'Age', type: 'number', required: true, min: 10, max: 19, placeholder: 'e.g. 15' },
    ],
  },
  {
    title: 'Education',
    fields: [
      { id: 'school_name', label: 'School Name (2025–26)', required: true, placeholder: 'e.g. Garfield High School' },
      {
        id: 'grade', label: 'Grade', type: 'select', required: true,
        options: ['', '6th', '7th', '8th', '9th', '10th', '11th', '12th'],
      },
      { id: 'awards',  label: 'Scholastic & Other Awards Received', type: 'textarea', rows: 3, placeholder: 'Honor roll, awards, recognitions…' },
      {
        id: 'gpa', label: 'GPA', required: true, placeholder: 'e.g. 3.8',
        hint: 'Please email your transcript separately to president@seattlesquash.com to complete your application.',
      },
    ],
  },
  {
    title: 'Squash Experience',
    fields: [
      { id: 'us_squash_membership', label: 'US Squash Membership No.', placeholder: 'e.g. 12345678' },
      { id: 'club_name', label: 'Club Name / Location', required: true, placeholder: 'e.g. Seattle Squash at Club XYZ' },
      {
        id: 'tournaments', label: 'Junior Accredited Tournaments (Academic Year)',
        type: 'textarea', rows: 4,
        placeholder: 'List the name and location of each Junior accredited squash tournament you played in during the 2025–26 academic year…',
      },
    ],
  },
  {
    title: 'Scholarship Request',
    fields: [
      {
        id: 'amount_requested', label: 'Amount Requested ($)', type: 'number',
        required: true, min: 1, max: 500, placeholder: 'Up to $500',
        hint: 'Seattle Squash will reimburse up to $500 to the selected athlete.',
      },
      {
        id: 'purpose', label: 'Purpose or Need for Funding', type: 'textarea',
        required: true, rows: 5,
        placeholder: 'Describe how the funds will be used (e.g. tournament fees, squash-related travel, equipment, school/education expenses)…',
      },
    ],
  },
];

export default function ScholarshipForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const set = (id: string, val: string) => setValues((v) => ({ ...v, [id]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/scholarship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(data.error ?? 'Submission failed — please try again.');
      }
    } catch {
      setError('Network error — please check your connection and try again.');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🎾</div>
        <h2 className="text-2xl font-bold text-foreground mb-3">Application Submitted!</h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Thank you for applying. The SSRA scholarship committee will review all submissions and be in touch.
        </p>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4 text-sm text-amber-800 dark:text-amber-300 text-left max-w-md mx-auto">
          <p className="font-semibold mb-1">One more step required</p>
          <p>Please email your academic transcript to{' '}
            <a href="mailto:president@seattlesquash.com" className="underline">president@seattlesquash.com</a>{' '}
            to complete your application.
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-6">A confirmation has been sent to {values.email}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {SECTIONS.map((section) => (
        <div key={section.title} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="bg-[#0f172a] px-5 py-3">
            <h2 className="text-sm font-semibold text-white tracking-wide">{section.title}</h2>
          </div>
          <div className="px-5 py-5 space-y-4">
            {section.fields.map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className="block text-sm font-medium text-foreground mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    id={field.id}
                    value={values[field.id] ?? ''}
                    onChange={(e) => set(field.id, e.target.value)}
                    required={field.required}
                    rows={field.rows ?? 3}
                    placeholder={field.placeholder}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : field.type === 'select' ? (
                  <select
                    id={field.id}
                    value={values[field.id] ?? ''}
                    onChange={(e) => set(field.id, e.target.value)}
                    required={field.required}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background"
                  >
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt || `Select ${field.label}`}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.id}
                    type={field.type ?? 'text'}
                    value={values[field.id] ?? ''}
                    onChange={(e) => set(field.id, e.target.value)}
                    required={field.required}
                    placeholder={field.placeholder}
                    min={field.min}
                    max={field.max}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}

                {field.hint && (
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                    <span className="shrink-0 mt-px">⚠️</span>
                    <span>{field.hint}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="bg-[#0f172a] text-white px-8 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Application'}
        </button>
        <p className="text-xs text-muted-foreground">
          Fields marked <span className="text-red-500 font-semibold">*</span> are required.
        </p>
      </div>

      <p className="text-xs text-muted-foreground pb-4">
        Your application will be emailed to the SSRA scholarship committee at{' '}
        <a href="mailto:president@seattlesquash.com" className="text-blue-600 dark:text-blue-400 hover:underline">
          president@seattlesquash.com
        </a>.
      </p>
    </form>
  );
}
