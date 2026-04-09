'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import type { EmailCampaign, EmailRecipient } from '@/lib/supabase/types';

type Tab = 'recipients' | 'compose' | 'history';
type Segment = 'all' | 'player' | 'volunteer' | 'invitee' | 'other';

const SEGMENT_LABELS: Record<Segment, string> = {
  all: 'All',
  player: 'Players',
  volunteer: 'Volunteers',
  invitee: 'Invitees',
  other: 'Other',
};

const TYPE_COLORS: Record<string, string> = {
  player: 'bg-blue-100 text-blue-700',
  volunteer: 'bg-green-100 text-green-700',
  invitee: 'bg-amber-100 text-amber-700',
  other: 'bg-zinc-100 text-zinc-600',
};

function parseCSV(text: string): { name: string; email: string; type?: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const nameIdx = headers.findIndex((h) => ['name', 'full name', 'fullname', 'player name'].includes(h));
  const emailIdx = headers.findIndex((h) => ['email', 'e-mail', 'email address'].includes(h));
  const typeIdx = headers.findIndex((h) => ['type', 'category', 'role', 'segment'].includes(h));
  const firstIdx = headers.findIndex((h) => ['first name', 'first', 'firstname', 'fname'].includes(h));
  const lastIdx = headers.findIndex((h) => ['last name', 'last', 'lastname', 'lname', 'surname'].includes(h));

  if (emailIdx === -1) return [];

  return lines.slice(1)
    .map((line) => {
      const cells = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const email = cells[emailIdx]?.toLowerCase();
      if (!email || !email.includes('@')) return null;

      let name = nameIdx >= 0 ? cells[nameIdx] : '';
      if (!name && (firstIdx >= 0 || lastIdx >= 0)) {
        name = [firstIdx >= 0 ? cells[firstIdx] : '', lastIdx >= 0 ? cells[lastIdx] : '']
          .filter(Boolean).join(' ');
      }
      if (!name) name = email.split('@')[0];

      const type = typeIdx >= 0 ? cells[typeIdx]?.toLowerCase() : undefined;
      const safeType = ['player', 'volunteer', 'invitee', 'other'].includes(type || '') ? type : 'invitee';

      return { name: name.trim(), email, type: safeType };
    })
    .filter(Boolean) as { name: string; email: string; type: string }[];
}

export default function EmailMarketing({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const [tab, setTab] = useState<Tab>('recipients');
  const [segment, setSegment] = useState<Segment>('all');
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendSegment, setSendSegment] = useState<Segment>('all');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Add single
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addType, setAddType] = useState<string>('invitee');

  // CSV import
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<{ name: string; email: string; type?: string }[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);

  // Sync from players/volunteers
  const [syncing, setSyncing] = useState(false);

  const refreshRecipients = async () => {
    if (!tournament) return;
    const r = await fetch(`/api/tournaments/${tournament.id}/email/recipients`).then((x) => x.ok ? x.json() : []);
    setRecipients(r);
  };

  useEffect(() => {
    if (!tournament) return;
    Promise.all([
      fetch(`/api/tournaments/${tournament.id}/email/recipients`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/tournaments/${tournament.id}/email/campaigns`).then((r) => r.ok ? r.json() : []),
    ]).then(([r, c]) => { setRecipients(r); setCampaigns(c); setLoading(false); });
  }, [tournament]);

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

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target?.result as string);
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const importCsv = async () => {
    if (!tournament || csvPreview.length === 0) return;
    setCsvImporting(true);
    await fetch(`/api/tournaments/${tournament.id}/email/recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(csvPreview),
    });
    setCsvPreview([]);
    if (csvRef.current) csvRef.current.value = '';
    await refreshRecipients();
    setCsvImporting(false);
  };

  const sendCampaign = async () => {
    if (!tournament || !subject || !body) return;
    setSending(true);
    setSendResult(null);

    // If segmented, temporarily set segment filter in campaign metadata
    const segmentParam = sendSegment !== 'all' ? `?segment=${sendSegment}` : '';

    const createRes = await fetch(`/api/tournaments/${tournament.id}/email/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, segment: sendSegment !== 'all' ? sendSegment : null }),
    });
    if (!createRes.ok) { setSendResult({ ok: false, msg: 'Failed to create campaign' }); setSending(false); return; }
    const campaign = await createRes.json();

    const sendRes = await fetch(`/api/tournaments/${tournament.id}/email/send${segmentParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: campaign.id }),
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
    setSending(false);
  };

  if (tLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen">Not found</div>;

  const visibleRecipients = segment === 'all' ? recipients : recipients.filter((r) => r.type === segment);
  const subscribedAll = recipients.filter((r) => r.subscribed).length;
  const subscribedSegment = (sendSegment === 'all' ? recipients : recipients.filter((r) => r.type === sendSegment)).filter((r) => r.subscribed).length;

  // Counts per segment
  const counts = recipients.reduce((acc, r) => {
    acc[r.type as Segment] = (acc[r.type as Segment] || 0) + 1;
    return acc;
  }, {} as Record<Segment, number>);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-1.5 text-sm text-zinc-500">
            <Link href="/admin" className="hover:text-zinc-700">Admin Dashboard</Link>
            <span>›</span>
            <Link href={`/t/${slug}/admin`} className="hover:text-zinc-700">{tournament.name}</Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Email Marketing</h1>
          <p className="text-sm text-zinc-600 mt-1">{subscribedAll} subscribed recipient{subscribedAll !== 1 ? 's' : ''}</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-zinc-200 rounded-xl p-1 mb-6">
          {(['recipients', 'compose', 'history'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
              {t === 'recipients' ? `Recipients (${recipients.length})` : t === 'compose' ? 'Compose' : 'History'}
            </button>
          ))}
        </div>

        {loading ? <p className="text-center py-12 text-zinc-600">Loading...</p> : tab === 'recipients' ? (
          <div className="space-y-5">
            {/* Segment filter pills */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'player', 'volunteer', 'invitee', 'other'] as Segment[]).map((s) => {
                const count = s === 'all' ? recipients.length : (counts[s] || 0);
                return (
                  <button key={s} onClick={() => setSegment(s)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${segment === s ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
                    {SEGMENT_LABELS[s]} {count > 0 && <span className="opacity-60">({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Sync buttons */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => syncFrom('players')} disabled={syncing}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {syncing ? 'Syncing...' : 'Sync Players'}
              </button>
              <button onClick={() => syncFrom('volunteers')} disabled={syncing}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {syncing ? 'Syncing...' : 'Sync Volunteers'}
              </button>
            </div>

            {/* CSV Import */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h3 className="font-semibold mb-3">Bulk Import via CSV</h3>
              <p className="text-xs text-zinc-600 mb-3">CSV must have an <strong>email</strong> column. Optional: <strong>name</strong>, <strong>type</strong> (player/volunteer/invitee/other).</p>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors">
                  Choose CSV
                  <input ref={csvRef} type="file" accept=".csv,.txt" onChange={handleCsvFile} className="hidden" />
                </label>
                {csvPreview.length > 0 && (
                  <>
                    <span className="text-sm text-zinc-600">{csvPreview.length} contacts found</span>
                    <button onClick={importCsv} disabled={csvImporting}
                      className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">
                      {csvImporting ? 'Importing...' : `Import ${csvPreview.length}`}
                    </button>
                    <button onClick={() => { setCsvPreview([]); if (csvRef.current) csvRef.current.value = ''; }}
                      className="text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
                  </>
                )}
              </div>
              {csvPreview.length > 0 && (
                <div className="mt-3 max-h-40 overflow-auto border border-zinc-100 rounded-lg">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-zinc-50">
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Email</th>
                      <th className="text-left px-3 py-2 font-medium">Type</th>
                    </tr></thead>
                    <tbody>
                      {csvPreview.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-t border-zinc-50">
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5 text-zinc-600">{r.email}</td>
                          <td className="px-3 py-1.5 text-zinc-600">{r.type || 'invitee'}</td>
                        </tr>
                      ))}
                      {csvPreview.length > 10 && <tr><td colSpan={3} className="px-3 py-1.5 text-zinc-500">...and {csvPreview.length - 10} more</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Add single */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h3 className="font-semibold mb-3">Add Single Recipient</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name"
                  className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
                <input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Email"
                  className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
                <select value={addType} onChange={(e) => setAddType(e.target.value)}
                  className="border border-zinc-300 rounded-lg px-3 py-2 text-sm">
                  <option value="invitee">Invitee</option>
                  <option value="player">Player</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="other">Other</option>
                </select>
                <button onClick={addRecipient}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800">Add</button>
              </div>
            </div>

            {/* Recipients table */}
            {visibleRecipients.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
                <p className="text-zinc-600">{segment !== 'all' ? `No ${SEGMENT_LABELS[segment].toLowerCase()} yet.` : 'No recipients yet.'}</p>
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Segment</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr></thead>
                  <tbody>
                    {visibleRecipients.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-50">
                        <td className="px-4 py-2.5 font-medium">{r.name}</td>
                        <td className="px-4 py-2.5 text-zinc-600">{r.email}</td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[r.type] || TYPE_COLORS.other}`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => removeRecipient(r.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === 'compose' ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            {/* Segment selector */}
            <div>
              <label className="block text-sm font-medium mb-2">Send To</label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'player', 'volunteer', 'invitee', 'other'] as Segment[]).map((s) => {
                  const count = (s === 'all' ? recipients : recipients.filter((r) => r.type === s)).filter((r) => r.subscribed).length;
                  return (
                    <button key={s} onClick={() => setSendSegment(s)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${sendSegment === s ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
                      {SEGMENT_LABELS[s]} <span className="opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. You're Invited to the Seattle Open 2026!"
                className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10}
                placeholder="Write your email here. Blank lines become paragraph breaks."
                className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm font-mono" />
            </div>

            <div className="bg-zinc-50 rounded-lg p-4 text-sm text-zinc-600">
              Sending to <strong className="text-zinc-900">{subscribedSegment}</strong> subscribed{sendSegment !== 'all' ? ` ${SEGMENT_LABELS[sendSegment].toLowerCase()}` : ''} recipient{subscribedSegment !== 1 ? 's' : ''}.
            </div>

            {sendResult && (
              <div className={`rounded-lg px-3 py-2 text-sm ${sendResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {sendResult.msg}
              </div>
            )}

            <button onClick={sendCampaign} disabled={sending || !subject || !body || subscribedSegment === 0}
              className="bg-zinc-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">
              {sending ? 'Sending...' : `Send to ${subscribedSegment} Recipient${subscribedSegment !== 1 ? 's' : ''}`}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
                <p className="text-zinc-600">No campaigns sent yet.</p>
              </div>
            ) : campaigns.map((c) => (
              <div key={c.id} className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{c.subject}</h3>
                    <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{c.body}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.status === 'sent' ? 'bg-green-100 text-green-700' : c.status === 'draft' ? 'bg-zinc-100 text-zinc-600' : c.status === 'sending' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      {c.status}
                    </span>
                    {c.sent_at && <p className="text-xs text-zinc-600 mt-1">{new Date(c.sent_at).toLocaleDateString()}</p>}
                    {c.sent_count > 0 && <p className="text-xs text-zinc-600">{c.sent_count} sent</p>}
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
