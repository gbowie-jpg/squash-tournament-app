'use client';

type ScheduledMatch = {
  id: string;
  match_number: number;
  draw: string | null;
  round: string | null;
  scheduled_time: string | null;
  status: string;
  player1?: { name: string; seed?: number | null } | null;
  player2?: { name: string; seed?: number | null } | null;
  court?: { id: string; name: string } | null;
};

export default function ScheduleGrid({
  matches,
  courts,
}: {
  matches: ScheduledMatch[];
  courts: { id: string; name: string }[];
}) {
  // Only show scheduled matches with times
  const scheduled = matches.filter((m) => m.scheduled_time && m.court);

  if (scheduled.length === 0) {
    return (
      <p className="text-sm text-zinc-400 text-center py-6">
        No matches scheduled yet. Use Auto-Schedule to assign courts and times.
      </p>
    );
  }

  // Get unique time slots
  const timeSlots = [...new Set(scheduled.map((m) => m.scheduled_time!))]
    .sort()
    .map((t) => new Date(t));

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const playerLabel = (p: { name: string; seed?: number | null } | null | undefined) => {
    if (!p) return 'TBD';
    return p.seed ? `[${p.seed}] ${p.name}` : p.name;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 border-b border-zinc-200 w-20">
              Time
            </th>
            {courts.map((c) => (
              <th
                key={c.id}
                className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 border-b border-zinc-200"
              >
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((time) => (
            <tr key={time.toISOString()} className="border-b border-zinc-100">
              <td className="px-3 py-2 text-xs text-zinc-500 font-medium whitespace-nowrap">
                {formatTime(time)}
              </td>
              {courts.map((court) => {
                const match = scheduled.find(
                  (m) =>
                    m.scheduled_time === time.toISOString() &&
                    m.court?.id === court.id,
                );
                return (
                  <td key={court.id} className="px-3 py-2">
                    {match ? (
                      <div className="bg-white border border-zinc-200 rounded-lg p-2">
                        <div className="text-xs text-zinc-400 mb-1">
                          M{match.match_number} · {match.draw} {match.round}
                        </div>
                        <div className="text-sm font-medium">
                          {playerLabel(match.player1)}
                        </div>
                        <div className="text-xs text-zinc-400">vs</div>
                        <div className="text-sm font-medium">
                          {playerLabel(match.player2)}
                        </div>
                      </div>
                    ) : (
                      <div className="h-16" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
