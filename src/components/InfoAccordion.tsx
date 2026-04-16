'use client';

import { useState } from 'react';

type Section = { label: string; content: string | null };

export default function InfoAccordion({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const visible = sections.filter((s) => s.content?.trim());
  if (visible.length === 0) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden divide-y divide-border bg-card">
      {visible.map((s) => {
        const panelId = `accordion-panel-${s.label.replace(/\s+/g, '-').toLowerCase()}`;
        const isOpen = open === s.label;
        return (
          <div key={s.label}>
            <button
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface transition-colors"
              onClick={() => setOpen(isOpen ? null : s.label)}
              aria-expanded={isOpen}
              aria-controls={panelId}
            >
              <span className="font-semibold text-sm uppercase tracking-wide text-foreground">{s.label}</span>
              <svg
                className={`w-4 h-4 text-dim transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isOpen && (
              <div id={panelId} className="px-5 pb-5 text-sm text-foreground whitespace-pre-wrap leading-relaxed border-t border-border">
                {s.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
