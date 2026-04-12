'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import ThemeToggle from '@/components/ThemeToggle';
import RefreshButton from '@/components/RefreshButton';

type Volunteer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  notes: string | null;
  created_at: string;
};

type MatchWithRef = {
  id: string;
  match_number: number | null;
  draw: string | null;
  round: string | null;
  referee_id: string | null;
  status: string;
  player1?: { name: string } | null;
  player2?: { name: string } | null;
};

export default function VolunteersAdmin({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tournamentLoading } = useTournament(slug);

  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [matches, setMatches] = useState<MatchWithRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament) return;
    Promise.all([
      fetch(`/api/tournaments/${tournament.id}/volunteers`).then((r) => r.json()),
      fetch(`/api/tournaments/${tournament.id}/matches`).then((r) => r.json()),
    ]).then(([v, m]) => {
      setVolunteers(v);
      setMatches(m);
      setLoading(false);
    });
  }, [tournament]);

  const referees = volunteers.filter((v) => v.role === 'referee');
  const others = volunteers.filter((v) => v.role !== 'referee');

  const handleAutoAssign = async () => {
    if (!tournament) return;
    setAssigning(true);
    setAssignResult(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/referees/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        setAssignResult(`Error: ${data.error}`);
        return;
      }
      setAssignResult(`Assigned ${data.assigned} matches across ${data.totalReferees} referees`);
      // Refresh matches
      const mRes = await fetch(`/api/tournaments/${tournament.id}/matches`);
      setMatches(await mRes.json());
    } finally {
      setAssigning(false);
    }
  };

  const handleManualAssign = async (matchId: string, refereeId: string | null) => {
    if (!tournament) return;
    await fetch(`/api/tournaments/${tournament.id}/matches`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: matchId, referee_id: refereeId || null }),
    });
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, referee_id: refereeId } : m)),
    );
  };

  const handleRemoveVolunteer = async (id: string) => {
    if (!tournament || !confirm('Remove this volunteer?')) return;
    await fetch(`/api/tournaments/${tournament.id}/volunteers`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ volunteerId: id }),
    });
    setVolunteers((prev) => prev.filter((v) => v.id !== id));
    setMatches((prev) =>
      prev.map((m) => (m.referee_id === id ? { ...m, referee_id: null } : m)),
    );
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      referee: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
      volunteer: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
      helper: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[role] || colors.helper}`}>
        {role}
      </span>
    );
  };

  // Matches that can have refs assigned (not walkover/cancelled/completed)
  const assignableMatches = matches.filter(
    (m) => !['walkover', 'cancelled', 'completed'].includes(m.status),
  );

  const refName = (refId: string | null) => {
    if (!refId) return null;
    return volunteers.find((v) => v.id === refId)?.name || 'Unknown';
  };

  if (tournamentLoading) return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-[var(--text-secondary)]">Not found</div>;

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)]">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                <Link href="/admin" className="hover:text-[var(--text-secondary)]">Admin Dashboard</Link>
                <span>›</span>
                <Link href={`/t/${slug}/admin`} className="hover:text-[var(--text-secondary)]">{tournament?.name ?? slug}</Link>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mt-1">Volunteers & Referees</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Public signup: <span className="text-[var(--text-secondary)] font-mono">/t/{slug}/volunteer</span>
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <ThemeToggle />
              <RefreshButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <p className="text-[var(--text-secondary)] text-center py-12">Loading...</p>
        ) : (
          <>
            {/* Volunteers list */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Referees */}
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Referees ({referees.length})</h2>
                  <button
                    onClick={handleAutoAssign}
                    disabled={assigning || referees.length === 0}
                    className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {assigning ? 'Assigning...' : 'Auto-Assign to Matches'}
                  </button>
                </div>
                {assignResult && (
                  <div className={`text-sm rounded-lg px-3 py-2 mb-3 ${assignResult.startsWith('Error') ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400'}`}>
                    {assignResult}
                  </div>
                )}
                {referees.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No referees signed up yet</p>
                ) : (
                  <div className="space-y-2">
                    {referees.map((v) => {
                      const assignedCount = matches.filter((m) => m.referee_id === v.id).length;
                      return (
                        <div key={v.id} className="flex items-center justify-between bg-[var(--surface)] rounded-lg px-3 py-2">
                          <div>
                            <span className="text-sm font-medium">{v.name}</span>
                            {v.email && <span className="text-xs text-[var(--text-secondary)] ml-2">{v.email}</span>}
                            {assignedCount > 0 && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">{assignedCount} matches</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveVolunteer(v.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Other volunteers */}
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <h2 className="font-semibold mb-4">Volunteers & Helpers ({others.length})</h2>
                {others.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No volunteers signed up yet</p>
                ) : (
                  <div className="space-y-2">
                    {others.map((v) => (
                      <div key={v.id} className="flex items-center justify-between bg-[var(--surface)] rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm font-medium">{v.name}</span>
                          {roleBadge(v.role)}
                          {v.email && <span className="text-xs text-[var(--text-secondary)] ml-2">{v.email}</span>}
                          {v.notes && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{v.notes}</p>}
                        </div>
                        <button
                          onClick={() => handleRemoveVolunteer(v.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Match referee assignments */}
            <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
              <h2 className="font-semibold mb-4">Match Referee Assignments</h2>
              {assignableMatches.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No matches to assign referees to</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-auto">
                  {assignableMatches
                    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
                    .map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface)]">
                        <span className="text-xs text-[var(--text-secondary)] w-8">M{m.match_number}</span>
                        <span className="text-xs text-[var(--text-secondary)] w-8">{m.round}</span>
                        <span className="flex-1 text-sm">
                          {m.player1?.name || 'TBD'} <span className="text-[var(--text-secondary)]">vs</span>{' '}
                          {m.player2?.name || 'TBD'}
                        </span>
                        <select
                          value={m.referee_id || ''}
                          onChange={(e) => handleManualAssign(m.id, e.target.value || null)}
                          className="border border-[var(--border)] rounded-lg px-2 py-1 text-xs bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none w-36"
                        >
                          <option value="">No referee</option>
                          {referees.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
