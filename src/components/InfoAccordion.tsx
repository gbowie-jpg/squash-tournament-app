'use client';

import { useState } from 'react';

type Section = { label: string; content: string | null };

export default function InfoAccordion({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const visible = sections.filter((s) => s.content?.trim());
  if (visible.length === 0) return null;

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200 bg-white">
      {visible.map((s) => (
        <div key={s.label}>
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
            onClick={() => setOpen(open === s.label ? null : s.label)}
          >
            <span className="font-semibold text-sm uppercase tracking-wide text-zinc-700">{s.label}</span>
            <svg
              className={`w-4 h-4 text-zinc-400 transition-transform ${open === s.label ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open === s.label && (
            <div className="px-5 pb-5 text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed border-t border-zinc-100">
              {s.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
