'use client';

import type { DrawFormat } from '@/lib/draws/types';

type PreviewMatch = {
  round: string;
  description: string;
  matchNumber: number;
};

export default function DrawPreview({
  matches,
  format,
}: {
  matches: PreviewMatch[];
  format: DrawFormat;
}) {
  // Group by round
  const rounds = [...new Set(matches.map((m) => m.round))];

  return (
    <div className="space-y-4">
      {rounds.map((round) => (
        <div key={round}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {round}
          </h4>
          <div className="space-y-1">
            {matches
              .filter((m) => m.round === round)
              .map((m) => (
                <div
                  key={m.matchNumber}
                  className={`text-sm px-3 py-2 rounded-lg border ${
                    m.description.includes('BYE')
                      ? 'bg-surface border-border text-muted-foreground'
                      : m.description.startsWith('Winner')
                        ? 'bg-amber-50 border-amber-100 text-amber-700'
                        : 'bg-card border-border'
                  }`}
                >
                  <span className="text-muted-foreground text-xs mr-2">M{m.matchNumber}</span>
                  {m.description}
                </div>
              ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        {format === 'single_elimination'
          ? `${matches.length} matches total (including byes)`
          : `${matches.length} matches across ${rounds.length} rounds`}
      </p>
    </div>
  );
}
