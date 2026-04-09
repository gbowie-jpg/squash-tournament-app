'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import type { EmailCampaign, EmailRecipient } from '@/lib/supabase/types';

type Tab = 'recipients' | 'compose' | 'history';

export default function EmailMarketing({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { tournament, loading: tLoading } = useTournament(slug);
  const [tab, setTab] = useState<Tab>('recipients');
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Add recipient form
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addType, setAddType] = useState<string>('invitee');

  // Import from players/volunteers
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!tournament) return;
    Promise.all([
      fetch(`/api/tournaments/${tournament.id}/email/recipients`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/tournaments/${tournament.id}/email/campaigns`).then((r) => r.ok ? r.json() : []),
    ]).then(([r, c]) => {
      setRecipients(r);
      setCampaigns(c);
      setLoading(false);
    });
  }, [tournament]);

  const addRecipient = async () => {
    if (!tournament || !addName || !addEmail) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/email/recipients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, email: addEmail, type: addType }),
    });
    if (res.ok) {
      const data = await res.json();
      setRecipients((prev) => [...prev, ...(Array.isArray(data) ? data : [data])]);
      setAddName('');
      setAddEmail('');
    }
  };

  const removeRecipient = async (id: string) => {
    if (!confirm('Remove this recipient?')) return;
    const res = await fetch(`/api/tournaments/${tournament!.id}/email/recipients`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: id }),
    });
    if (res.ok) setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const importFromPlayers = async () => {
    if (!tournament) return;
    setImporting(true);
    const res = await fetch(`/api/tournaments/${tournament.id}/players`);
    if (res.ok) {
      const players = await res.json();
      const withEmail = players.filter((p: { email?: string; name: string }) => p.email);
      if (withEmail.length > 0) {
        const importRes = await fetch(`/api/tournaments/${tournament.id}/email/recipients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(withEmail.map((p: { name: string; email: string }) => ({
            name: p.name,
            email: p.email,
            type: 'player',
          }))),
        });
        if (importRes.ok) {
          const data = await importRes.json();
          // Refresh the full list to avoid duplicates
          const refreshRes = await fetch(`/api/tournaments/${tournament.id}/email/recipients`);
          if (refreshRes.ok) setRecipients(await refreshRes.json());
          else setRecipients((prev) => [...prev, ...(Array.isArray(data) ? data : [data])]);
        }
      }
    }
    setImporting(false);
  };

  const importFromVolunteers = async () => {
    if (!tournament) return;
    setImporting(true);
    const res = await fetch(`/api/tournaments/${tournament.id}/volunteers`);
    if (res.ok) {
      const volunteers = await res.json();
      const withEmail = volunteers.filter((v: { email?: string; name: string }) => v.email);
      if (withEmail.length > 0) {
        await fetch(`/api/tournaments/${tournament.id}/email/recipients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(withEmail.map((v: { name: string; email: string }) => ({
            name: v.name,
            email: v.email,
            type: 'volunteer',
          }))),
        });
        const refreshRes = await fetch(`/api/tournaments/${tournament.id}/email/recipients`);
        if (refreshRes.ok) setRecipients(await refreshRes.json());
      }
    }
    setImporting(false);
  };

  const sendCampaign = async () => {
    if (!tournament || !subject || !body) return;
    setSending(true);
    setSendResult(null);

    // Create campaign
    const createRes = await fetch(`/api/tournaments/${tournament.id}/email/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    });
    if (!createRes.ok) {
      setSendResult('Failed to create campaign');
      setSending(false);
      return;
    }
    const campaign = await createRes.json();

    // Send it
    const sendRes = await fetch(`/api/tournaments/${tournament.id}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: campaign.id }),
    });

    if (sendRes.ok) {
      const result = await sendRes.json();
      setSendResult(`Sent to ${result.sent} recipients${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
      setSubject('');
      setBody('');
      setCampaigns((prev) => [{ ...campaign, status: 'sent', sent_count: result.sent }, ...prev]);
    } else {
      const err = await sendRes.json();
      setSendResult(err.error || 'Send failed');
    }
    setSending(false);
  };

  if (tLoading) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Loading...</div>;
  if (!tournament) return <div className="flex items-center justify-center min-h-screen text-zinc-600">Not found</div>;

  const subscribedCount = recipients.filter((r) => r.subscribed).length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href={`/t/${slug}/admin`} className="text-sm text-zinc-600 hover:text-zinc-800">
            &larr; {tournament.name}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Email Marketing</h1>
          <p className="text-sm text-zinc-600 mt-1">
            {subscribedCount} subscribed recipient{subscribedCount !== 1 ? 's' : ''}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-zinc-200 rounded-xl p-1 mb-6">
          {(['recipients', 'compose', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {t === 'recipients' ? `Recipients (${recipients.length})` : t === 'compose' ? 'Compose' : 'History'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-zinc-600 text-center py-12">Loading...</p>
        ) : tab === 'recipients' ? (
          <div className="space-y-6">
            {/* Import buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={importFromPlayers}
                disabled={importing}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import Players'}
              </button>
              <button
                onClick={importFromVolunteers}
                disabled={importing}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import Volunteers'}
              </button>
            </div>

            {/* Add single recipient */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h3 className="font-semibold mb-3">Add Recipient</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="Email"
                  className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={addType}
                  onChange={(e) => setAddType(e.target.value)}
                  className="border border-zinc-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="invitee">Invitee</option>
                  <option value="player">Player</option>
                  <option value="volunteer">Volunteer</option>
                  <option value="other">Other</option>
                </select>
                <button
                  onClick={addRecipient}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Recipients list */}
            {recipients.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
                <p className="text-zinc-600">No recipients yet. Import from players/volunteers or add manually.</p>
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      <th className="text-left px-4 py-3 font-medium">Name</th>
                      <th className="text-left px-4 py-3 font-medium">Email</th>
                      <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Type</th>
                      <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-50">
                        <td className="px-4 py-2.5 font-medium">{r.name}</td>
                        <td className="px-4 py-2.5 text-zinc-600">{r.email}</td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            r.type === 'player' ? 'bg-blue-100 text-blue-700' :
                            r.type === 'volunteer' ? 'bg-green-100 text-green-700' :
                            r.type === 'invitee' ? 'bg-amber-100 text-amber-700' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => removeRecipient(r.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === 'compose' ? (
          <div className="space-y-6">
            <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. You're Invited to the Seattle Open 2026!"
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  placeholder="Write your email here. Use blank lines between paragraphs."
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm font-mono"
                />
              </div>
              <div className="bg-zinc-50 rounded-lg p-4 text-sm text-zinc-600">
                This will be sent to <strong className="text-zinc-900">{subscribedCount}</strong> subscribed recipient{subscribedCount !== 1 ? 's' : ''} as a branded HTML email from Seattle Squash.
              </div>

              {sendResult && (
                <div className={`rounded-lg px-3 py-2 text-sm ${
                  sendResult.startsWith('Sent') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {sendResult}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={sendCampaign}
                  disabled={sending || !subject || !body || subscribedCount === 0}
                  className="bg-zinc-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                >
                  {sending ? 'Sending...' : `Send to ${subscribedCount} Recipients`}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* History tab */
          <div className="space-y-4">
            {campaigns.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
                <p className="text-zinc-600">No campaigns sent yet.</p>
              </div>
            ) : (
              campaigns.map((c) => (
                <div key={c.id} className="bg-white border border-zinc-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{c.subject}</h3>
                      <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{c.body}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        c.status === 'sent' ? 'bg-green-100 text-green-700' :
                        c.status === 'draft' ? 'bg-zinc-100 text-zinc-600' :
                        c.status === 'sending' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {c.status}
                      </span>
                      {c.sent_at && (
                        <p className="text-xs text-zinc-600 mt-1">
                          {new Date(c.sent_at).toLocaleDateString()}
                        </p>
                      )}
                      {c.sent_count > 0 && (
                        <p className="text-xs text-zinc-600">
                          {c.sent_count} sent
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
