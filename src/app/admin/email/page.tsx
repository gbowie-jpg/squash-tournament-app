'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

type Recipient = {
  id: string;
  name: string;
  email: string;
  tags: string[];
  subscribed: boolean;
  created_at: string;
};

type Campaign = {
  id: string;
  subject: string;
  body: string;
  status: 'draft' | 'sending' | 'sent' | 'failed';
  tags: string[];
  sent_at: string | null;
  sent_count: number;
  created_at: string;
};

type Tab = 'recipients' | 'compose' | 'history';

function parseCSV(text: string): { name: string; email: string; tags?: string[] }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));
  const emailIdx = headers.findIndex((h) => ['email', 'e-mail', 'email address'].includes(h));
  const nameIdx = headers.findIndex((h) => ['name', 'full name', 'fullname'].includes(h));
  const firstIdx = headers.findIndex((h) => ['first name', 'first', 'firstname'].includes(h));
  const lastIdx = headers.findIndex((h) => ['last name', 'last', 'lastname', 'surname'].includes(h));
  const tagsIdx = headers.findIndex((h) => ['tags', 'tag', 'group', 'category'].includes(h));

  if (emailIdx === -1) return [];

  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const email = cells[emailIdx]?.toLowerCase();
    if (!email || !email.includes('@')) return null;

    let name = nameIdx >= 0 ? cells[nameIdx] : '';
    if (!name && (firstIdx >= 0 || lastIdx >= 0)) {
      name = [firstIdx >= 0 ? cells[firstIdx] : '', lastIdx >= 0 ? cells[lastIdx] : ''].filter(Boolean).join(' ');
    }
    if (!name) name = email.split('@')[0];

    const tags = tagsIdx >= 0 && cells[tagsIdx] ? cells[tagsIdx].split(';').map((t) => t.trim()).filter(Boolean) : [];

    return { name: name.trim(), email, tags };
  }).filter(Boolean) as { name: string; email: string; tags: string[] }[];
}

export default function GlobalEmail() {
  const [tab, setTab] = useState<Tab>('recipients');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter / tags
  const [tagFilter, setTagFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // Compose
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendTags, setSendTags] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Add single
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addTagInput, setAddTagInput] = useState('');

  // CSV
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<{ name: string; email: string; tags?: string[] }[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);

  const refresh = async () => {
    const [r, c] = await Promise.all([
      fetch('/api/admin/email/recipients').then((x) => x.ok ? x.json() : []),
      fetch('/api/admin/email/campaigns').then((x) => x.ok ? x.json() : []),
    ]);
    setRecipients(r);
    setCampaigns(c);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  // All unique tags across recipients
  const allTags = [...new Set(recipients.flatMap((r) => r.tags || []))].sort();

  const filteredRecipients = recipients.filter((r) => {
    const matchesTag = !tagFilter || (r.tags || []).includes(tagFilter);
    const matchesSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase());
    return matchesTag && matchesSearch;
  });

  const sendTargetCount = (() => {
    const eligible = recipients.filter((r) => r.subscribed);
    if (sendTags.length === 0) return eligible.length;
    return eligible.filter((r) => sendTags.some((t) => (r.tags || []).includes(t))).length;
  })();

  const addRecipient = async () => {
    if (!addName || !addEmail) return;
    const tags = addTagInput ? addTagInput.split(',').map((t) => t.trim()).filter(Boolean) : [];
    await fetch('/api/admin/email/recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName, email: addEmail, tags }),
    });
    setAddName(''); setAddEmail(''); setAddTagInput('');
    await refresh();
  };

  const removeRecipient = async (id: string) => {
    if (!confirm('Remove this recipient?')) return;
    await fetch('/api/admin/email/recipients', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: id }),
    });
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvPreview(parseCSV(ev.target?.result as string));
    reader.readAsText(file);
  };

  const importCsv = async () => {
    if (csvPreview.length === 0) return;
    setCsvImporting(true);
    await fetch('/api/admin/email/recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(csvPreview),
    });
    setCsvPreview([]);
    if (csvRef.current) csvRef.current.value = '';
    await refresh();
    setCsvImporting(false);
  };

  const toggleSendTag = (tag: string) => {
    setSendTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const sendCampaign = async () => {
    if (!subject || !body) return;
    setSending(true);
    setSendResult(null);

    const createRes = await fetch('/api/admin/email/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body, tags: sendTags }),
    });
    if (!createRes.ok) { setSendResult({ ok: false, msg: 'Failed to create campaign' }); setSending(false); return; }
    const campaign = await createRes.json();

    const sendRes = await fetch('/api/admin/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: campaign.id, tags: sendTags.length > 0 ? sendTags : undefined }),
    });

    if (sendRes.ok) {
      const result = await sendRes.json();
      setSendResult({ ok: true, msg: `Sent to ${result.sent} recipients${result.failed > 0 ? `, ${result.failed} failed` : ''}` });
      setSubject(''); setBody(''); setSendTags([]);
      await refresh();
    } else {
      const err = await sendRes.json();
      setSendResult({ ok: false, msg: err.error || 'Send failed' });
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/admin" className="text-sm text-zinc-600 hover:text-zinc-800">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Email Marketing</h1>
          <p className="text-sm text-zinc-600 mt-1">
            {recipients.filter((r) => r.subscribed).length} subscribed · {recipients.length} total
          </p>
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
            {/* Search + tag filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..."
                className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm">
                <option value="">All Tags</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* CSV Import */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <h3 className="font-semibold mb-1">Bulk Import via CSV</h3>
              <p className="text-xs text-zinc-600 mb-3">Required: <strong>email</strong>. Optional: <strong>name</strong>, <strong>tags</strong> (semicolon-separated, e.g. <em>members;newsletter</em>).</p>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
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
                      <th className="text-left px-3 py-2 font-medium">Tags</th>
                    </tr></thead>
                    <tbody>
                      {csvPreview.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-t border-zinc-50">
                          <td className="px-3 py-1.5">{r.name}</td>
                          <td className="px-3 py-1.5 text-zinc-600">{r.email}</td>
                          <td className="px-3 py-1.5 text-zinc-600">{(r.tags || []).join(', ') || '—'}</td>
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
                <input value={addTagInput} onChange={(e) => setAddTagInput(e.target.value)} placeholder="Tags (comma-separated)"
                  className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm" />
                <button onClick={addRecipient}
                  className="bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800">Add</button>
              </div>
            </div>

            {/* Recipients table */}
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              {filteredRecipients.length === 0 ? (
                <p className="text-center text-zinc-600 py-8">No recipients found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="bg-zinc-50 border-b border-zinc-100">
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Tags</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr></thead>
                  <tbody>
                    {filteredRecipients.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-50">
                        <td className="px-4 py-2.5 font-medium">{r.name}</td>
                        <td className="px-4 py-2.5 text-zinc-600">{r.email}</td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(r.tags || []).map((tag) => (
                              <span key={tag} className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => removeRecipient(r.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : tab === 'compose' ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            {/* Tag targeting */}
            <div>
              <label className="block text-sm font-medium mb-2">Send To</label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setSendTags([])}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${sendTags.length === 0 ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
                  Everyone ({recipients.filter((r) => r.subscribed).length})
                </button>
                {allTags.map((tag) => {
                  const count = recipients.filter((r) => r.subscribed && (r.tags || []).includes(tag)).length;
                  const active = sendTags.includes(tag);
                  return (
                    <button key={tag} onClick={() => toggleSendTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${active ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'}`}>
                      {tag} ({count})
                    </button>
                  );
                })}
              </div>
              {sendTags.length > 0 && (
                <p className="text-xs text-zinc-600 mt-2">Sending to recipients tagged: {sendTags.join(', ')}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Seattle Squash — Spring Season Update"
                className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
                placeholder="Write your message here. Blank lines become paragraph breaks."
                className="w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-sm font-mono" />
            </div>

            <div className="bg-zinc-50 rounded-lg p-4 text-sm text-zinc-600">
              Sending to <strong className="text-zinc-900">{sendTargetCount}</strong> subscribed recipient{sendTargetCount !== 1 ? 's' : ''}{sendTags.length > 0 ? ` tagged "${sendTags.join('", "')}"` : ''}.
            </div>

            {sendResult && (
              <div className={`rounded-lg px-3 py-2 text-sm ${sendResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {sendResult.msg}
              </div>
            )}

            <button onClick={sendCampaign} disabled={sending || !subject || !body || sendTargetCount === 0}
              className="bg-zinc-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50">
              {sending ? 'Sending...' : `Send to ${sendTargetCount} Recipient${sendTargetCount !== 1 ? 's' : ''}`}
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
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{c.subject}</h3>
                    <p className="text-sm text-zinc-600 mt-1 line-clamp-2">{c.body}</p>
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {c.tags.map((tag) => (
                          <span key={tag} className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
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
