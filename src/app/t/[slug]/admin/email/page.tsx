'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import ThemeToggle from '@/components/ThemeToggle';
import RefreshButton from '@/components/RefreshButton';
import type { EmailCampaign, EmailRecipient } from '@/lib/supabase/types';

type Tab = 'recipients' | 'compose' | 'history';
type Segment = 'all' | 'player' | 'volunteer' | 'invitee' | 'other';

const SEGMENT_LABELS: Record<Segment, string> = {
  all: 'All', player: 'Players', volunteer: 'Volunteers', invitee: 'Invitees', other: 'Other',
};
const TYPE_COLORS: Record<string, string> = {
  player: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400',
  volunteer: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
  invitee: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400',
  other: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
};

// Parses a single CSV line, correctly handling quoted fields (e.g. "Smith, John")
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): { name: string; email: string; type?: string; tags?: string[] }[] {
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, ''));
  const nameIdx  = headers.findIndex((h) => ['name', 'full name', 'fullname', 'player name', 'player'].includes(h));
  const emailIdx = headers.findIndex((h) => ['email', 'e-mail', 'email address'].includes(h));
  const typeIdx  = headers.findIndex((h) => ['type', 'category', 'role', 'segment'].includes(h));
  const tagsIdx  = headers.findIndex((h) => ['tag', 'tags', 'group', 'groups', 'label', 'labels'].includes(h));
  const firstIdx = headers.findIndex((h) => ['first name', 'first', 'firstname', 'fname'].includes(h));
  const lastIdx  = headers.findIndex((h) => ['last name', 'last', 'lastname', 'lname', 'surname'].includes(h));

  if (emailIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const email = cells[emailIdx]?.toLowerCase().trim();
    if (!email || !email.includes('@')) return null;
    let name = nameIdx >= 0 ? cells[nameIdx] ?? '' : '';
    if (!name && (firstIdx >= 0 || lastIdx >= 0)) {
      name = [firstIdx >= 0 ? cells[firstIdx] : '', lastIdx >= 0 ? cells[lastIdx] : ''].filter(Boolean).join(' ');
    }
    if (!name) name = email.split('@')[0];
    const type = typeIdx >= 0 ? cells[typeIdx]?.toLowerCase().trim() : undefined;
    const safeType = ['player', 'volunteer', 'invitee', 'other'].includes(type ?? '') ? type : 'invitee';
    // Tags can be separated by ; or , within the cell (e.g. "prior_tourney; non_WA")
    const tagRaw = tagsIdx >= 0 ? cells[tagsIdx] ?? '' : '';
    const tags = tagRaw
      .split(/[;,]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    return { name: name.trim(), email, type: safeType, tags };
  }).filter(Boolean) as { name: string; email: string; type: string; tags: string[] }[];
}

export default function EmailMarketing({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const [tab, setTab] = useState<Tab>('recipients');
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Recipients tab filters
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment>('all');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Add single
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addType, setAddType] = useState('invitee');

  // CSV import
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<{ name: string; email: string; type?: string; tags?: string[] }[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvStatus, setCsvStatus] = useState<string>('');
  const [csvError, setCsvError] = useState<string>('');
  const [csvSkipExisting, setCsvSkipExisting] = useState(false);

  // Sync
  const [syncing, setSyncing] = useState(false);

  // Compose filters
  const [sendSegment, setSendSegment] = useState<Segment>('all');
  const [sendTags, setSendTags] = useState<string[]>([]);
  const [subscribedOnly, setSubscribedOnly] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSendingEmail] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const refreshRecipients = async () => {
    if (!tournament) return;
    const r = await fetch(`/api/tournaments/${tournament.id}/email/recipients`).then((x) => x.ok ? x.json() : []);
    setRecipients(r);
  };

  useEffect(() => {
    console.log('[CSV] email page mounted — build v3 (visible native input)');
    if (!tournament) return;
    Promise.all([
      fetch(`/api/tournaments/${tournament.id}/email/recipients`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/tournaments/${tournament.id}/email/campaigns`).then((r) => r.ok ? r.json() : []),
    ]).then(([r, c]) => { setRecipients(r); setCampaigns(c); setLoading(false); });
  }, [tournament]);

  // All unique tags across recipients
  const allTags = Array.from(new Set(recipients.flatMap((r) => r.tags ?? []))).sort();

  // Recipients tab: apply search + segment filter
  const visibleRecipients = recipients.filter((r) => {
    if (segment !== 'all' && r.type !== segment) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) ||
        (r.tags ?? []).some((t) => t.includes(q));
    }
    return true;
  });

  // Compose: compute matching recipient count
  const sendRecipients = recipients.filter((r) => {
    if (subscribedOnly && !r.subscribed) return false;
    if (sendSegment !== 'all' && r.type !== sendSegment) return false;
    if (sendTags.length > 0 && !sendTags.some((t) => (r.tags ?? []).includes(t))) return false;
    return true;
  });

  const counts = recipients.reduce((acc, r) => {
    acc[r.type as Segment] = (acc[r.type as Segment] || 0) + 1;
    return acc;
  }, {} as Record<Segment, number>);

  // --- Handlers ---

  const startEdit = (r: EmailRecipient) => {
    setEditingId(r.id);
    setEditName(r.name);
    setEditType(r.type);
    setEditTags(r.tags ?? []);
    setEditTagInput('');
  };

  const cancelEdit = () => { setEditingId(null); setEditTagInput(''); setEditError(null); };

  const addEditTag = () => {
    const t = editTagInput.trim().toLowerCase();
    if (t && !editTags.includes(t)) setEditTags([...editTags, t]);
    setEditTagInput('');
  };

  const removeEditTag = (t: string) => setEditTags(editTags.filter((x) => x !== t));

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournament!.id}/email/recipients`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: editingId, name: editName, type: editType, tags: editTags }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecipients((prev) => prev.map((r) => r.id === editingId ? data : r));
        setEditingId(null);
        setEditError(null);
      } else {
        setEditError(data.error || `Save failed (${res.status})`);
      }
    } catch (e) {
      setEditError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = async () => {
    if (!tournament || !addName || !addEmail) return;
    await fetch(`/api/tournaments/${tournament.id}/email/recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, email: addEmail, type: addType }),
    });
    setAddName(''); setAddEmail('');
    await refreshRecipients();
  };

  const removeRecipient = async (id: string) => {
    if (!confirm('Remove this recipient?')) return;
    await fetch(`/api/tournaments/${tournament!.id}/email/recipients`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: id }),
    });
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const syncFrom = async (source: 'players' | 'volunteers') => {
    if (!tournament) return;
    setSyncing(true);
    const res = await fetch(`/api/tournaments/${tournament.id}/${source}`);
    if (res.ok) {
      const items = await res.json();
      const withEmail = items.filter((x: { email?: string }) => x.email);
      if (withEmail.length > 0) {
        await fetch(`/api/tournaments/${tournament.id}/email/recipients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(withEmail.map((x: { name: string; email: string }) => ({
            name: x.name, email: x.email,
            type: source === 'players' ? 'player' : 'volunteer',
          }))),
        });
        await refreshRecipients();
      }
    }
    setSyncing(false);
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError('');
    setCsvStatus('');
    const file = e.target.files?.[0];
    console.log('[CSV] onChange fired. file =', file);
    if (!file) {
      setCsvError('No file selected.');
      return;
    }
    setCsvStatus(`Reading ${file.name} (${(file.size / 1024).toFixed(1)} KB)…`);

    // Reset the input value right away so selecting the same file again re-fires onChange
    try { e.target.value = ''; } catch {}

    try {
      // Race file.text() against a timeout so cloud-synced offline files don't hang silently.
      const text = await Promise.race([
        file.text(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Timed out after 8s — file may be offline in a cloud folder (iCloud/Dropbox). Copy it to your Desktop first.')),
            8000
          )
        ),
      ]);
      console.log('[CSV] file.text() resolved. length =', (text as string).length);
      setCsvStatus(`Parsing ${(text as string).length} chars…`);
      const rows = parseCSV(text as string);
      console.log('[CSV] parsed rows =', rows.length, rows.slice(0, 3));
      if (rows.length === 0) {
        setCsvError('No valid rows found. The CSV must have an "email" column, and emails must contain "@".');
        setCsvStatus('');
        return;
      }
      setCsvPreview(rows);
      setCsvStatus(`Found ${rows.length} contacts — review below and click Import.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[CSV] error:', msg);
      setCsvError(msg);
      setCsvStatus('');
    }
  };

  // Emails already in the list — used for duplicate highlighting in preview
  const existingEmailSet = new Set(recipients.map((r) => r.email.toLowerCase()));

  const csvNew = csvPreview.filter((r) => !existingEmailSet.has(r.email.toLowerCase()));
  const csvExisting = csvPreview.filter((r) => existingEmailSet.has(r.email.toLowerCase()));
  const csvToImport = csvSkipExisting ? csvNew : csvPreview;

  const importCsv = async () => {
    if (!tournament || csvToImport.length === 0) return;
    setCsvImporting(true);
    await fetch(`/api/tournaments/${tournament.id}/email/recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(csvToImport),
    });
    setCsvPreview([]);
    setCsvStatus('');
    setCsvError('');
    setCsvSkipExisting(false);
    if (csvRef.current) csvRef.current.value = '';
    await refreshRecipients();
    setCsvImporting(false);
  };

  const sendCampaign = async () => {
    if (!tournament || !subject || !body) return;
    setSendingEmail(true);
    setSendResult(null);
    const createRes = await fetch(`/api/tournaments/${tournament.id}/email/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject, body,
        segment: sendSegment !== 'all' ? sendSegment : null,
      }),
    });
    if (!createRes.ok) { setSendResult({ ok: false, msg: 'Failed to create campaign' }); setSendingEmail(false); return; }
    const campaign = await createRes.json();

    const sendRes = await fetch(`/api/tournaments/${tournament.id}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        segment: sendSegment !== 'all' ? sendSegment : undefined,
        tags: sendTags.length > 0 ? sendTags : undefined,
      }),
    });
    if (sendRes.ok) {
      const result = await sendRes.json();
      setSendResult({ ok: true, msg: `Sent to ${result.sent} recipients${result.failed > 0 ? `, ${result.failed} failed` : ''}` });
      setSubject(''); setBody('');
      setCampaigns((prev) => [{ ...campaign, status: 'sent', sent_count: result.sent }, ...prev]);
    } else {
      const err = await sendRes.json();
      setSendResult({ ok: false, msg: err.error || 'Send failed' });
    }
    setSendingEmail(false);
  };

  if (tLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen">Not found</div>;

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="bg-[var(--surface-card)] border-b border-[var(--border)]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                <Link href="/admin" className="hover:text-[var(--text-secondary)]">Admin Dashboard</Link>
                <span>›</span>
                <Link href={`/t/${slug}/admin`} className="hover:text-[var(--text-secondary)]">{tournament.name}</Link>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mt-1">Email Marketing</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{recipients.filter((r) => r.subscribed).length} subscribed · {recipients.length} total</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <ThemeToggle />
              <RefreshButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-1 mb-6">
          {(['recipients', 'compose', 'history'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-foreground text-card' : 'text-[var(--text-secondary)] hover:bg-surface'}`}>
              {t === 'recipients' ? `Recipients (${recipients.length})` : t === 'compose' ? 'Compose' : 'History'}
            </button>
          ))}
        </div>

        {loading ? <p className="text-center py-12 text-[var(--text-secondary)]">Loading...</p> : tab === 'recipients' ? (
          <div className="space-y-5">
            {/* Search + segment */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, or tag…"
                className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-zinc-900"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'player', 'volunteer', 'invitee', 'other'] as Segment[]).map((s) => {
                const count = s === 'all' ? recipients.length : (counts[s] || 0);
                return (
                  <button key={s} onClick={() => setSegment(s)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${segment === s ? 'bg-foreground text-card' : 'bg-[var(--surface-card)] border border-[var(--border)] text-[var(--text-primary)] hover:opacity-80'}`}>
                    {SEGMENT_LABELS[s]} {count > 0 && <span className="opacity-60">({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Sync + import */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => syncFrom('players')} disabled={syncing}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {syncing ? 'Syncing…' : 'Sync Players'}
              </button>
              <button onClick={() => syncFrom('volunteers')} disabled={syncing}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {syncing ? 'Syncing…' : 'Sync Volunteers'}
              </button>
            </div>

            {/* CSV Import */}
            <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-semibold mb-3">Bulk Import via CSV</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-3">CSV must have an <strong>email</strong> column. Optional: <strong>name</strong> (or <strong>player</strong>), <strong>type</strong> (player/volunteer/invitee/other).</p>

              {/* Fully visible native file input — zero indirection, no label, no ref.click().
                  Browser renders its own "Choose File" button which directly fires onChange. */}
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  id="csv-file-input"
                  ref={csvRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleCsvFile}
                  onClick={() => console.log('[CSV] input clicked')}
                  className="block text-sm text-foreground file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-surface file:text-foreground file:cursor-pointer hover:file:opacity-80 border border-border rounded-lg p-1"
                  aria-label="Choose CSV file"
                />
                {csvPreview.length > 0 && (
                  <>
                    <button onClick={importCsv} disabled={csvImporting || csvToImport.length === 0}
                      className="bg-foreground text-card px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                      {csvImporting ? 'Importing…' : `Import ${csvToImport.length}`}
                    </button>
                    <button onClick={() => { setCsvPreview([]); setCsvStatus(''); setCsvError(''); setCsvSkipExisting(false); if (csvRef.current) csvRef.current.value = ''; }}
                      className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Cancel</button>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">build v3 · if you don't see &quot;[CSV] email page mounted&quot; in console on load, the new code isn't running.</p>

              {/* Visible status + error feedback so silent failures are impossible */}
              {csvStatus && !csvPreview.length && (
                <div className="mt-3 text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg px-3 py-2">
                  {csvStatus}
                </div>
              )}
              {csvError && (
                <div className="mt-3 text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-3 py-2">
                  {csvError}
                </div>
              )}
              {csvPreview.length > 0 && (
                <div className="mt-3 space-y-3">
                  {/* Duplicate summary banner */}
                  {csvExisting.length > 0 ? (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 space-y-2">
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        <strong>{csvNew.length} new</strong> · <strong>{csvExisting.length} already in list</strong>
                        {!csvSkipExisting && <span className="text-amber-600 dark:text-amber-400"> — existing contacts will have their tags merged and name updated</span>}
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input
                          type="checkbox"
                          checked={csvSkipExisting}
                          onChange={(e) => setCsvSkipExisting(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">Skip existing — only import {csvNew.length} new contact{csvNew.length !== 1 ? 's' : ''}</span>
                      </label>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)]">
                      <strong>{csvPreview.length}</strong> new contacts — none are in the list yet
                    </p>
                  )}

                  {/* Preview table */}
                  <div className="max-h-60 overflow-auto border border-[var(--border)] rounded-lg">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-[var(--surface)]">
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium">Tags</th>
                        <th className="px-3 py-2 w-20"></th>
                      </tr></thead>
                      <tbody>
                        {csvPreview.slice(0, 15).map((r, i) => {
                          const isExisting = existingEmailSet.has(r.email.toLowerCase());
                          const skipped = csvSkipExisting && isExisting;
                          return (
                            <tr key={i} className={`border-t border-[var(--border)] ${skipped ? 'opacity-40' : isExisting ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                              <td className="px-3 py-1.5 font-medium">{r.name}</td>
                              <td className="px-3 py-1.5 text-[var(--text-secondary)]">{r.email}</td>
                              <td className="px-3 py-1.5 text-[var(--text-secondary)]">{(r.tags ?? []).join(', ') || '—'}</td>
                              <td className="px-3 py-1.5 text-right">
                                {skipped
                                  ? <span className="text-[var(--text-muted)]">skip</span>
                                  : isExisting
                                    ? <span className="text-amber-600 dark:text-amber-400 font-medium">update</span>
                                    : <span className="text-green-600 dark:text-green-400 font-medium">new</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                        {csvPreview.length > 15 && (
                          <tr><td colSpan={4} className="px-3 py-1.5 text-[var(--text-muted)]">
                            …and {csvPreview.length - 15} more
                            {csvExisting.length > 0 && ` (${csvPreview.slice(15).filter(r => existingEmailSet.has(r.email.toLowerCase())).length} existing)`}
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Add single */}
            <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="font-semibold mb-3">Add Single Recipient</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name"
                  className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)]" />
                <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Email"
                  className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)]" />
                <select value={addType} onChange={(e) => setAddType(e.target.value)}
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)]">
                  <option value="invitee">Invitee</option>
                  <option value="player">Player</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="other">Other</option>
                </select>
                <button onClick={addRecipient}
                  className="bg-foreground text-card px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Add</button>
              </div>
            </div>

            {/* Recipients table */}
            {visibleRecipients.length === 0 ? (
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-8 text-center">
                <p className="text-[var(--text-secondary)]">{search ? 'No matches.' : segment !== 'all' ? `No ${SEGMENT_LABELS[segment].toLowerCase()} yet.` : 'No recipients yet.'}</p>
              </div>
            ) : (
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                    <th className="text-left px-4 py-3 font-medium">Name / Tags</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Type</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr></thead>
                  <tbody>
                    {visibleRecipients.map((r) => (
                      editingId === r.id ? (
                        /* Inline edit row */
                        <tr key={r.id} className="border-b border-[var(--border)] bg-amber-50 dark:bg-amber-950/20">
                          <td colSpan={4} className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap gap-2">
                                <input value={editName} onChange={(e) => setEditName(e.target.value)}
                                  className="border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm flex-1 min-w-32 bg-[var(--surface)] text-[var(--text-primary)]" placeholder="Name" />
                                <select value={editType} onChange={(e) => setEditType(e.target.value)}
                                  className="border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm bg-[var(--surface)] text-[var(--text-primary)]">
                                  <option value="invitee">Invitee</option>
                                  <option value="player">Player</option>
                                  <option value="volunteer">Volunteer</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              {/* Tag editor */}
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {editTags.map((t) => (
                                  <span key={t} className="inline-flex items-center gap-1 bg-surface text-foreground text-xs px-2 py-0.5 rounded-full border border-border">
                                    {t}
                                    <button onClick={() => removeEditTag(t)} aria-label={`Remove tag ${t}`} className="text-muted-foreground hover:text-foreground leading-none">×</button>
                                  </span>
                                ))}
                                <input
                                  value={editTagInput}
                                  onChange={(e) => setEditTagInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditTag(); } if (e.key === ',') { e.preventDefault(); addEditTag(); } }}
                                  placeholder="Add tag, press Enter…"
                                  className="border border-[var(--border)] rounded-lg px-2 py-1 text-xs w-40 bg-[var(--surface)] text-[var(--text-primary)]"
                                />
                                {/* Quick-add existing tags */}
                                {allTags.filter((t) => !editTags.includes(t)).map((t) => (
                                  <button key={t} onClick={() => setEditTags([...editTags, t])}
                                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-dashed border-[var(--border)] px-1.5 py-0.5 rounded-full">
                                    + {t}
                                  </button>
                                ))}
                              </div>
                              {editError && (
                                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">{editError}</p>
                              )}
                              <div className="flex gap-2 mt-1">
                                <button onClick={saveEdit} disabled={saving}
                                  className="bg-foreground text-card px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                                  {saving ? 'Saving…' : 'Save'}
                                </button>
                                <button onClick={cancelEdit} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={r.id} className="border-b border-[var(--border)] hover:bg-[var(--surface)]">
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{r.name}</div>
                            {(r.tags ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(r.tags ?? []).map((t) => (
                                  <span key={t} className="bg-surface text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">{t}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[var(--text-secondary)] hidden sm:table-cell">{r.email}</td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[r.type] || TYPE_COLORS.other}`}>
                              {r.type}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => startEdit(r)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">Edit</button>
                              <button onClick={() => removeRecipient(r.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        ) : tab === 'compose' ? (
          <div className="space-y-5">
            {/* Filter bar */}
            <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-sm">Send To</h3>

              {/* Type */}
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Type</p>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'player', 'volunteer', 'invitee', 'other'] as Segment[]).map((s) => {
                    const count = (s === 'all' ? recipients : recipients.filter((r) => r.type === s))
                      .filter((r) => !subscribedOnly || r.subscribed).length;
                    return (
                      <button key={s} onClick={() => setSendSegment(s)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${sendSegment === s ? 'bg-foreground text-card border-foreground' : 'bg-[var(--surface-card)] border-[var(--border)] text-[var(--text-primary)] hover:opacity-80'}`}>
                        {SEGMENT_LABELS[s]} <span className="opacity-60">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-2">Tags <span className="normal-case font-normal">(select any to filter)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((t) => {
                      const active = sendTags.includes(t);
                      return (
                        <button key={t}
                          onClick={() => setSendTags(active ? sendTags.filter((x) => x !== t) : [...sendTags, t])}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${active ? 'bg-foreground text-card border-foreground' : 'bg-[var(--surface-card)] border-[var(--border)] text-[var(--text-primary)] hover:opacity-80'}`}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Subscribed toggle */}
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input type="checkbox" checked={subscribedOnly} onChange={(e) => setSubscribedOnly(e.target.checked)}
                  className="rounded" />
                <span className="text-sm text-[var(--text-primary)]">Subscribed only</span>
              </label>

              {/* Live count */}
              <div className={`rounded-lg px-4 py-3 text-sm font-medium ${sendRecipients.length === 0 ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-[var(--surface)] text-[var(--text-primary)]'}`}>
                {sendRecipients.length === 0
                  ? 'No recipients match these filters.'
                  : <>Sending to <strong className="text-[var(--text-primary)]">{sendRecipients.length}</strong> recipient{sendRecipients.length !== 1 ? 's' : ''}
                    {sendTags.length > 0 && <span className="text-[var(--text-secondary)]"> with tag{sendTags.length > 1 ? 's' : ''}: {sendTags.join(', ')}</span>}
                  </>
                }
              </div>
            </div>

            {/* Message */}
            <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. You're Invited to the Seattle Open 2026!"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
                  placeholder="Write your email here. Blank lines become paragraph breaks."
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm font-mono bg-[var(--surface)] text-[var(--text-primary)]" />
              </div>

              {sendResult && (
                <div className={`rounded-lg px-3 py-2 text-sm ${sendResult.ok ? 'bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                  {sendResult.msg}
                </div>
              )}

              <button onClick={sendCampaign} disabled={sending || !subject || !body || sendRecipients.length === 0}
                className="bg-foreground text-card px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {sending ? 'Sending…' : `Send to ${sendRecipients.length} Recipient${sendRecipients.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

        ) : (
          <div className="space-y-4">
            {campaigns.length === 0 ? (
              <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-8 text-center">
                <p className="text-[var(--text-secondary)]">No campaigns sent yet.</p>
              </div>
            ) : campaigns.map((c) => (
              <div key={c.id} className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{c.subject}</h3>
                    <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">{c.body}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.status === 'sent' ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400' : c.status === 'draft' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400' : c.status === 'sending' ? 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400' : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'}`}>
                      {c.status}
                    </span>
                    {c.sent_at && <p className="text-xs text-[var(--text-secondary)] mt-1">{new Date(c.sent_at).toLocaleDateString()}</p>}
                    {c.sent_count > 0 && <p className="text-xs text-[var(--text-secondary)]">{c.sent_count} sent</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
