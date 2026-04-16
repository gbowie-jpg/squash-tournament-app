'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { startMasquerade } from '@/components/MasqueradeBanner';

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
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

  // Masquerade state
  const [masquerading, setMasquerading] = useState<string | null>(null); // userId being masqueraded

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

  const handleStatusChange = async (userId: string, status: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status } : u)),
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

  const handleMasquerade = async (targetUserId: string) => {
    setMasquerading(targetUserId);
    try {
      const res = await fetch('/api/admin/masquerade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to start masquerade');
        return;
      }
      // Store masquerade info BEFORE navigating so the banner shows after redirect
      startMasquerade(data.name, data.email);
      // Navigate to the magic link — Supabase will sign in as the target user
      window.location.href = data.magicLink;
    } catch {
      alert('Network error');
    } finally {
      setMasquerading(null);
    }
  };

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      superadmin: 'bg-red-100 text-red-700',
      admin: 'bg-blue-100 text-blue-700',
      user: 'bg-surface text-muted-foreground',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[role] || colors.user}`}>
        {role}
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      suspended: 'bg-red-100 text-red-700',
      inactive: 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] || colors.active}`}>
        {status || 'active'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <Link href="/admin/tournaments" className="text-sm text-muted-foreground hover:text-foreground">
              &larr; Tournaments
            </Link>
            <h1 className="text-2xl font-bold tracking-tight mt-1">User Management</h1>
            <p className="text-sm text-muted-foreground">Manage users, roles, and tournament access</p>
          </div>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground text-sm">
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
          <div className="space-y-4">
            <div className="h-24 rounded-xl bg-card animate-pulse" />
            <div className="h-24 rounded-xl bg-card animate-pulse" />
            <div className="h-24 rounded-xl bg-card animate-pulse" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No users found.</p>
        ) : (
          <div className="space-y-4">
            {users.map((u) => (
              <div key={u.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{u.full_name || u.email}</h3>
                      {roleBadge(u.role)}
                      {statusBadge(u.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={u.status || 'active'}
                      onChange={(e) => handleStatusChange(u.id, e.target.value)}
                      className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="border border-border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                    {u.id !== user?.id && (
                      <button
                        onClick={() => handleMasquerade(u.id)}
                        disabled={masquerading === u.id}
                        title="Sign in as this user to see their view"
                        className="bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
                      >
                        {masquerading === u.id ? '...' : '🎭'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Tournament access */}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Tournament Access
                  </h4>
                  {u.organizers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tournament access</p>
                  ) : (
                    <div className="space-y-1">
                      {u.organizers.map((o) => (
                        <div key={o.id} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{o.tournament?.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground bg-surface px-1.5 py-0.5 rounded border border-border">
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
                        className="flex-1 border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="scorer">Scorer</option>
                      </select>
                      <button
                        onClick={() => handleAddOrganizer(u.id)}
                        className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddOrg(null)}
                        className="text-muted-foreground hover:text-foreground text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddOrg(u.id)}
                      className="text-xs text-muted-foreground hover:text-foreground mt-2 underline"
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
