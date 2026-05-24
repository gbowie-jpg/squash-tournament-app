'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function TournamentQRCode({ url, tournamentName }: { url: string; tournamentName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] hover:bg-[var(--surface)] transition-colors text-[var(--text-primary)]"
      >
        <span aria-hidden="true">📲</span> Share / Join
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-8 max-w-xs w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-1">
              Scan to join
            </p>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-5 leading-tight">
              {tournamentName}
            </h2>

            <div className="flex justify-center mb-5">
              <div className="p-3 bg-white rounded-xl shadow-inner border border-zinc-100">
                <QRCodeSVG
                  value={url}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#18181b"
                  level="M"
                  marginSize={1}
                />
              </div>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1 break-all">{url}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-6">
              Players scan this to get live updates &amp; scores
            </p>

            <button
              onClick={() => setOpen(false)}
              className="w-full py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
