'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/lib/supabase/types';
import { ChevronLeft, Camera, Check } from 'lucide-react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function AccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [club, setClub] = useState('');
  const [phone, setPhone] = useState('');
  const [ranking, setRanking] = useState('');
  const [bio, setBio] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      fetch('/api/account/profile')
        .then((r) => r.json())
        .then((p: Profile) => {
          setProfile(p);
          setFullName(p.full_name ?? '');
          setClub(p.club ?? '');
          setPhone(p.phone ?? '');
          setRanking(p.squash_ranking ?? '');
          setBio(p.bio ?? '');
          setIsAdmin(p.role === 'admin' || p.role === 'superadmin');
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/account/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        club,
        phone,
        squash_ranking: ranking,
        bio,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Failed to save');
    } else {
      const updated: Profile = await res.json();
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/account/photo', { method: 'POST', body: form });
    setUploading(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Upload failed');
    } else {
      const { url } = await res.json();
      setProfile((p) => p ? { ...p, photo_url: url } : p);
    }
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      {/* Header */}
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href={isAdmin ? '/admin' : '/'}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 -ml-1 flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">{isAdmin ? 'Admin' : 'Home'}</span>
          </Link>
          <h1 className="text-lg font-bold flex-1 text-[var(--text-primary)]">My Profile</h1>
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
          <ThemeToggle className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-zinc-100 dark:hover:bg-zinc-800" />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Photo */}
        <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-5 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt="Profile photo"
                className="w-20 h-20 rounded-full object-cover border-2 border-[var(--border)]"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-3xl font-bold text-zinc-500 select-none">
                {fullName ? fullName[0].toUpperCase() : '?'}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-zinc-800">{fullName || profile?.email || 'Your Profile'}</p>
            <p className="text-sm text-zinc-500">{profile?.email}</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5" />
              {uploading ? 'Uploading…' : 'Change photo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Player Details</h2>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Squash Ranking / Rating</label>
            <input
              type="text"
              value={ranking}
              onChange={(e) => setRanking(e.target.value)}
              placeholder="e.g. 4.5, A, 500 PSA, etc."
              className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Club</label>
            <input
              type="text"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="Your club or home court"
              className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number"
              className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Bio <span className="text-[var(--text-muted)]">(optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A few words about yourself…"
              rows={3}
              className="w-full border border-[var(--border)] bg-[var(--surface)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-[var(--text-primary)]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold py-3 rounded-xl hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>

        {/* Sign out */}
        <div className="text-center pb-8">
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="text-sm text-[var(--text-muted)] hover:text-red-600 dark:hover:text-red-400"
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
