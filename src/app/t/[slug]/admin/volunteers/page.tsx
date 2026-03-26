'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';

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
      referee: 'bg-blue-100 text-blue-700',
      volunteer: 'bg-green-100 text-green-700',
      helper: 'bg-zinc-100 text-zinc-600',
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

  if (tournamentLoading) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Not found</div>;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link href={`/t/${slug}/admin`} className="text-sm text-zinc-600 hover:text-zinc-800">
            &larr; Admin
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Volunteers & Referees</h1>
          <p className="text-sm text-zinc-600">
            Public signup: <span className="text-zinc-600 font-mono">/t/{slug}/volunteer</span>
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <p className="text-zinc-600 text-center py-12">Loading...</p>
        ) : (
          <>
            {/* Volunteers list */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Referees */}
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Referees ({referees.length})</h2>
                  <button
                    onClick={handleAutoAssign}
                    disabled={assigning || referees.length === 0}
                    className="bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {assigning ? 'Assigning...' : 'Auto-Assign to Matches'}
                  </button>
                </div>
                {assignResult && (
                  <div className={`text-sm rounded-lg px-3 py-2 mb-3 ${assignResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {assignResult}
                  </div>
                )}
                {referees.length === 0 ? (
                  <p className="text-sm text-zinc-600">No referees signed up yet</p>
                ) : (
                  <div className="space-y-2">
                    {referees.map((v) => {
                      const assignedCount = matches.filter((m) => m.referee_id === v.id).length;
                      return (
                        <div key={v.id} className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-sm font-medium">{v.name}</span>
                            {v.email && <span className="text-xs text-zinc-600 ml-2">{v.email}</span>}
                            {assignedCount > 0 && (
                              <span className="text-xs text-blue-600 ml-2">{assignedCount} matches</span>
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
              <div className="bg-white border border-zinc-200 rounded-xl p-5">
                <h2 className="font-semibold mb-4">Volunteers & Helpers ({others.length})</h2>
                {others.length === 0 ? (
                  <p className="text-sm text-zinc-600">No volunteers signed up yet</p>
                ) : (
                  <div className="space-y-2">
                    {others.map((v) => (
                      <div key={v.id} className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm font-medium">{v.name}</span>
                          {roleBadge(v.role)}
                          {v.email && <span className="text-xs text-zinc-600 ml-2">{v.email}</span>}
                          {v.notes && <p className="text-xs text-zinc-600 mt-0.5">{v.notes}</p>}
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
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h2 className="font-semibold mb-4">Match Referee Assignments</h2>
              {assignableMatches.length === 0 ? (
                <p className="text-sm text-zinc-600">No matches to assign referees to</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-auto">
                  {assignableMatches
                    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
                    .map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50">
                        <span className="text-xs text-zinc-600 w-8">M{m.match_number}</span>
                        <span className="text-xs text-zinc-600 w-8">{m.round}</span>
                        <span className="flex-1 text-sm">
                          {m.player1?.name || 'TBD'} <span className="text-zinc-600">vs</span>{' '}
                          {m.player2?.name || 'TBD'}
                        </span>
                        <select
                          value={m.referee_id || ''}
                          onChange={(e) => handleManualAssign(m.id, e.target.value || null)}
                          className="border border-zinc-300 rounded-lg px-2 py-1 text-xs focus:outline-none w-36"
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
