'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  organizers: {
    id: string;
    tournament_id: string;
    role: string;
    tournament: { id: string; name: string; slug: string } | null;
  }[];
};

type Tournament = {
  id: string;
  name: string;
  slug: string;
};

export default function UserManagement() {
  const { user, signOut } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add organizer modal state
  const [showAddOrg, setShowAddOrg] = useState<string | null>(null); // userId
  const [addOrgTournament, setAddOrgTournament] = useState('');
  const [addOrgRole, setAddOrgRole] = useState<'admin' | 'scorer'>('admin');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/users').then((r) => {
        if (!r.ok) throw new Error('Not authorized');
        return r.json();
      }),
      fetch('/api/tournaments').then((r) => r.json()),
    ])
      .then(([usersData, tournamentsData]) => {
        setUsers(usersData);
        setTournaments(tournamentsData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u)),
      );
    }
  };

  const handleAddOrganizer = async (userId: string) => {
    if (!addOrgTournament) return;
    const res = await fetch('/api/admin/organizers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        tournamentId: addOrgTournament,
        role: addOrgRole,
      }),
    });
    if (res.ok) {
      const org = await res.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, organizers: [...u.organizers, org] }
            : u,
        ),
      );
      setShowAddOrg(null);
      setAddOrgTournament('');
    }
  };

  const handleRemoveOrganizer = async (userId: string, organizerId: string) => {
    if (!confirm('Remove this tournament access?')) return;
    const res = await fetch('/api/admin/organizers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizerId }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, organizers: u.organizers.filter((o) => o.id !== organizerId) }
            : u,
        ),
      );
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      superadmin: 'bg-red-100 text-red-700',
      admin: 'bg-blue-100 text-blue-700',
      user: 'bg-zinc-100 text-zinc-600',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[role] || colors.user}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link href="/admin/tournaments" className="text-sm text-zinc-600 hover:text-zinc-800">
              &larr; Tournaments
            </Link>
            <h1 className="text-2xl font-bold tracking-tight mt-1">User Management</h1>
            <p className="text-sm text-zinc-600">Manage users, roles, and tournament access</p>
          </div>
          <button onClick={signOut} className="text-zinc-600 hover:text-zinc-800 text-sm">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 text-center">
            <p className="font-medium">Access Denied</p>
            <p className="text-sm mt-1">You need superadmin permissions to manage users.</p>
          </div>
        ) : loading ? (
          <p className="text-zinc-600 text-center py-12">Loading...</p>
        ) : (
          <div className="space-y-4">
            {users.map((u) => (
              <div key={u.id} className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{u.full_name || u.email}</h3>
                      {roleBadge(u.role)}
                    </div>
                    <p className="text-sm text-zinc-600">{u.email}</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="border border-zinc-300 rounded-lg px-2 py-1 text-xs focus:outline-none"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>

                {/* Tournament access */}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-2">
                    Tournament Access
                  </h4>
                  {u.organizers.length === 0 ? (
                    <p className="text-sm text-zinc-600">No tournament access</p>
                  ) : (
                    <div className="space-y-1">
                      {u.organizers.map((o) => (
                        <div key={o.id} className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{o.tournament?.name || 'Unknown'}</span>
                            <span className="text-xs text-zinc-600 bg-zinc-200 px-1.5 py-0.5 rounded">
                              {o.role}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveOrganizer(u.id, o.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add tournament access */}
                  {showAddOrg === u.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={addOrgTournament}
                        onChange={(e) => setAddOrgTournament(e.target.value)}
                        className="flex-1 border border-zinc-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                      >
                        <option value="">Select tournament...</option>
                        {tournaments
                          .filter((t) => !u.organizers.some((o) => o.tournament_id === t.id))
                          .map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                      </select>
                      <select
                        value={addOrgRole}
                        onChange={(e) => setAddOrgRole(e.target.value as 'admin' | 'scorer')}
                        className="border border-zinc-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                      >
                        <option value="admin">Admin</option>
                        <option value="scorer">Scorer</option>
                      </select>
                      <button
                        onClick={() => handleAddOrganizer(u.id)}
                        className="bg-zinc-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-zinc-800"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddOrg(null)}
                        className="text-zinc-600 hover:text-zinc-800 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddOrg(u.id)}
                      className="text-xs text-zinc-600 hover:text-zinc-700 mt-2 underline"
                    >
                      + Add tournament access
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
