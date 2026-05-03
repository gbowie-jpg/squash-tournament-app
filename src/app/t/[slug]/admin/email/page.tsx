'use client';

import { useState, useEffect, useRef, use, useCallback } from 'react';
import Link from 'next/link';
import { useTournament } from '@/lib/useTournament';
import ThemeToggle from '@/components/ThemeToggle';
import RefreshButton from '@/components/RefreshButton';
import type { EmailCampaign, EmailRecipient } from '@/lib/supabase/types';

type Tab = 'recipients' | 'compose' | 'history';
type Segment = 'all' | 'player' | 'volunteer' | 'invitee' | 'other';

// ─── Block editor types ──────────────────────────────────────────────────────

type BlockType = 'paragraph' | 'heading' | 'subheading' | 'bullets' | 'button' | 'image' | 'divider';

interface Block {
  id: string;
  type: BlockType;
  text?: string;
  items?: string[];
  label?: string;
  url?: string;
  alt?: string;
}

function newBlock(type: BlockType): Block {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString();
  switch (type) {
    case 'paragraph':   return { id, type, text: '' };
    case 'heading':     return { id, type, text: '' };
    case 'subheading':  return { id, type, text: '' };
    case 'bullets':     return { id, type, items: [''] };
    case 'button':      return { id, type, label: '', url: '' };
    case 'image':       return { id, type, url: '', alt: '' };
    case 'divider':     return { id, type };
  }
}

/** Serialize blocks → HTML body (inner content only, no wrapper). */
function blocksToHtml(blocks: Block[]): string {
  return blocks.map((b) => {
    switch (b.type) {
      case 'paragraph':
        return `<p style="margin:0 0 18px 0;line-height:1.7;color:#1e293b;">${(b.text || '').replace(/\n/g, '<br/>')}</p>`;
      case 'heading':
        return `<h2 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3;">${b.text || ''}</h2>`;
      case 'subheading':
        return `<h3 style="margin:0 0 10px 0;font-size:16px;font-weight:600;color:#334155;line-height:1.4;">${b.text || ''}</h3>`;
      case 'bullets': {
        const items = (b.items || []).filter(Boolean).map(
          (item) => `<li style="margin:0 0 6px 0;color:#1e293b;line-height:1.6;">${item}</li>`
        ).join('');
        return `<ul style="margin:0 0 18px 0;padding-left:20px;">${items}</ul>`;
      }
      case 'button':
        return `<p style="margin:0 0 24px 0;text-align:center;"><a href="${b.url || '#'}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.01em;">${b.label || 'Click here'}</a></p>`;
      case 'image':
        return `<p style="margin:0 0 20px 0;text-align:center;"><img src="${b.url || ''}" alt="${b.alt || ''}" style="max-width:100%;height:auto;border-radius:8px;" /></p>`;
      case 'divider':
        return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;
      default:
        return '';
    }
  }).join('');
}

// ─── Block editor components ─────────────────────────────────────────────────

const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: 'Text', heading: 'Heading', subheading: 'Subheading',
  bullets: 'Bullets', button: 'Button', image: 'Image', divider: 'Divider',
};
const BLOCK_ICONS: Record<BlockType, string> = {
  paragraph: '¶', heading: 'H', subheading: 'h', bullets: '•',
  button: '⊞', image: '🖼', divider: '—',
};

function BlockCard({
  block, index, total,
  onChange, onRemove, onMove,
}: {
  block: Block;
  index: number;
  total: number;
  onChange: (updated: Block) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
}) {
  const inputClass = 'w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-zinc-400';

  return (
    <div
      className="group bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-3"
      style={{ transition: 'box-shadow 0.15s' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          {BLOCK_ICONS[block.type]} {BLOCK_LABELS[block.type]}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMove('up')} disabled={index === 0}
            className="w-6 h-6 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            title="Move up"
          >↑</button>
          <button
            onClick={() => onMove('down')} disabled={index === total - 1}
            className="w-6 h-6 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            title="Move down"
          >↓</button>
          <button
            onClick={onRemove}
            className="w-6 h-6 rounded text-xs text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center"
            title="Remove block"
          >×</button>
        </div>
      </div>

      {/* Editors */}
      {block.type === 'paragraph' && (
        <textarea
          rows={3} value={block.text || ''}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Write your paragraph…"
          className={inputClass}
        />
      )}
      {block.type === 'heading' && (
        <input type="text" value={block.text || ''}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Section heading…"
          className={inputClass}
        />
      )}
      {block.type === 'subheading' && (
        <input type="text" value={block.text || ''}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Subheading…"
          className={inputClass}
        />
      )}
      {block.type === 'bullets' && (
        <div className="space-y-2">
          {(block.items || []).map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-[var(--text-muted)] text-sm shrink-0">•</span>
              <input type="text" value={item}
                onChange={(e) => {
                  const items = [...(block.items || [])];
                  items[i] = e.target.value;
                  onChange({ ...block, items });
                }}
                placeholder={`Item ${i + 1}…`}
                className={inputClass}
              />
              {(block.items || []).length > 1 && (
                <button
                  onClick={() => {
                    const items = (block.items || []).filter((_, j) => j !== i);
                    onChange({ ...block, items });
                  }}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0"
                >×</button>
              )}
            </div>
          ))}
          <button
            onClick={() => onChange({ ...block, items: [...(block.items || []), ''] })}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] underline"
          >+ Add item</button>
        </div>
      )}
      {block.type === 'button' && (
        <div className="flex gap-2">
          <input type="text" value={block.label || ''}
            onChange={(e) => onChange({ ...block, label: e.target.value })}
            placeholder="Button label"
            className={inputClass}
          />
          <input type="url" value={block.url || ''}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            placeholder="https://…"
            className={inputClass}
          />
        </div>
      )}
      {block.type === 'image' && (
        <div className="space-y-2">
          <input type="url" value={block.url || ''}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            placeholder="Image URL (https://…)"
            className={inputClass}
          />
          <input type="text" value={block.alt || ''}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            placeholder="Alt text"
            className={inputClass}
          />
        </div>
      )}
      {block.type === 'divider' && (
        <div className="text-center text-[var(--text-muted)] text-sm py-1 select-none">— Divider —</div>
      )}
    </div>
  );
}

/** Simplified live preview of how the email will look. */
function EmailPreview({ blocks, tournamentName }: { blocks: Block[]; tournamentName: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)] text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f172a', padding: '24px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>{tournamentName}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Seattle Squash</div>
      </div>
      {/* Accent bar */}
      <div style={{ height: 4, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6,#ec4899)' }} />
      {/* Body */}
      <div style={{ background: '#ffffff', padding: '28px 28px 20px', minHeight: 80 }}>
        {blocks.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', margin: '20px 0', fontSize: 13 }}>Add blocks to see a preview…</p>
        ) : blocks.map((b) => {
          switch (b.type) {
            case 'paragraph':
              return <p key={b.id} style={{ margin: '0 0 16px', lineHeight: 1.7, color: '#1e293b', fontSize: 14 }}>{b.text || <span style={{ color: '#cbd5e1' }}>Empty paragraph</span>}</p>;
            case 'heading':
              return <h2 key={b.id} style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{b.text || <span style={{ color: '#cbd5e1', fontWeight: 400 }}>Heading</span>}</h2>;
            case 'subheading':
              return <h3 key={b.id} style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#334155' }}>{b.text || <span style={{ color: '#cbd5e1', fontWeight: 400 }}>Subheading</span>}</h3>;
            case 'bullets':
              return (
                <ul key={b.id} style={{ margin: '0 0 16px', paddingLeft: 20 }}>
                  {(b.items || []).map((item, i) => (
                    <li key={i} style={{ marginBottom: 4, color: '#1e293b', lineHeight: 1.6, fontSize: 14 }}>{item || <span style={{ color: '#cbd5e1' }}>Item</span>}</li>
                  ))}
                </ul>
              );
            case 'button':
              return (
                <div key={b.id} style={{ textAlign: 'center', margin: '0 0 20px' }}>
                  <span style={{ display: 'inline-block', background: '#0f172a', color: '#ffffff', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
                    {b.label || 'Button'}
                  </span>
                </div>
              );
            case 'image':
              return b.url
                ? <div key={b.id} style={{ textAlign: 'center', margin: '0 0 16px' }}><img src={b.url} alt={b.alt || ''} style={{ maxWidth: '100%', borderRadius: 8 }} /></div>
                : <div key={b.id} style={{ textAlign: 'center', margin: '0 0 16px', color: '#cbd5e1', fontSize: 13 }}>[ Image: no URL set ]</div>;
            case 'divider':
              return <hr key={b.id} style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />;
            default:
              return null;
          }
        })}
      </div>
      {/* Footer */}
      <div style={{ background: '#f8fafc', padding: '16px 28px', textAlign: 'center', borderTop: '1px solid #e2e8f0' }}>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 11 }}>Seattle Squash Racquets Association · P.O. Box 665, Seattle, WA 98111</p>
      </div>
    </div>
  );
}

// ─── Attachment state type ───────────────────────────────────────────────────

interface AttachmentState {
  name: string;
  size: number;
  base64: string;
  mimeType: string;
}

const SEGMENT_LABELS: Record<Segment, string> = {
  all: 'All', player: 'Players', volunteer: 'Volunteers', invitee: 'Invitees', other: 'Other',
};
const TYPE_COLORS: Record<string, string> = {
  player:    'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  volunteer: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300',
  invitee:   'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
  other:     'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
};

const TYPE_ICONS: Record<string, string> = {
  player: '🎯', volunteer: '🙋', invitee: '✉️', other: '•',
};

/** Deterministic hue from a string — same tag always gets the same colour. */
function tagHue(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff;
  return h % 360;
}

function TagPill({ tag }: { tag: string }) {
  const hue = tagHue(tag);
  // Use CSS custom properties so a parent .dark class can flip lightness values
  return (
    <span
      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full dark:opacity-90"
      style={{
        backgroundColor: `hsl(${hue},50%,87%)`,
        color: `hsl(${hue},60%,28%)`,
      }}
    >
      {tag}
    </span>
  );
}

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
  const [csvBulkType, setCsvBulkType] = useState<string>('auto');
  const [csvSuccess, setCsvSuccess] = useState<string>('');

  // Sync
  const [syncing, setSyncing] = useState(false);

  // Compose filters
  const [sendSegment, setSendSegment] = useState<Segment>('all');
  const [sendTags, setSendTags] = useState<string[]>([]);
  const [subscribedOnly, setSubscribedOnly] = useState(true);
  const [subject, setSubject] = useState('');
  // Block editor state
  const [blocks, setBlocks] = useState<Block[]>([{ id: '1', type: 'paragraph', text: '' }]);
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');
  // Attachment state
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [attachWarning, setAttachWarning] = useState<string>('');
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSendingEmail] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const refreshRecipients = async () => {
    if (!tournament) return;
    const res = await fetch(`/api/tournaments/${tournament.id}/email/recipients`);
    if (res.ok) {
      const r = await res.json();
      setRecipients(r);
    }
    // on error: leave existing list intact rather than wiping it
  };

  useEffect(() => {
    if (!tournament) return;
    Promise.all([
      fetch(`/api/tournaments/${tournament.id}/email/recipients`).then((r) => r.json()),
      fetch(`/api/tournaments/${tournament.id}/email/campaigns`).then((r) => r.json()),
    ]).then(([r, c]) => {
      setRecipients(Array.isArray(r) ? r : []);
      setCampaigns(Array.isArray(c) ? c : []);
      setLoading(false);
    }).catch(() => setLoading(false));
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
  const csvFiltered = csvSkipExisting ? csvNew : csvPreview;
  // Apply bulk-type override if set (replaces auto-detected or default 'invitee')
  const csvToImport = csvBulkType === 'auto'
    ? csvFiltered
    : csvFiltered.map((r) => ({ ...r, type: csvBulkType }));

  const importCsv = async () => {
    if (!tournament || csvToImport.length === 0) return;
    setCsvImporting(true);
    setCsvError('');
    const skipped = csvPreview.length - csvToImport.length;
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/email/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(csvToImport),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCsvError(`Import failed (${res.status}): ${err.error || 'unknown error'}`);
        setCsvImporting(false);
        return;
      }
      const saved = await res.json();
      const savedCount = Array.isArray(saved) ? saved.length : csvToImport.length;
      setCsvPreview([]);
      setCsvStatus('');
      setCsvSkipExisting(false);
      setCsvBulkType('auto');
      if (csvRef.current) csvRef.current.value = '';
      await refreshRecipients();
      const msg = skipped > 0
        ? `✓ ${savedCount} contacts imported (${skipped} existing skipped)`
        : `✓ ${savedCount} contacts imported`;
      setCsvSuccess(msg);
      setTimeout(() => setCsvSuccess(''), 5000);
    } catch (e) {
      setCsvError(`Network error — ${e instanceof Error ? e.message : 'please try again'}`);
    } finally {
      setCsvImporting(false);
    }
  };

  // ── Block editor handlers ──
  const updateBlock = useCallback((updated: Block) => {
    setBlocks((prev) => prev.map((b) => b.id === updated.id ? updated : b));
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const moveBlock = useCallback((id: string, dir: 'up' | 'down') => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }, []);

  const addBlock = useCallback((type: BlockType) => {
    setBlocks((prev) => [...prev, newBlock(type)]);
  }, []);

  // ── Attachment handler ──
  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachWarning('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setAttachWarning('File is too large (max 15 MB). Please choose a smaller file.');
      if (attachInputRef.current) attachInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAttachWarning('Large attachments (>5 MB) may be blocked by some email providers.');
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip the "data:<mime>;base64," prefix — Resend wants raw base64
      const base64 = dataUrl.split(',')[1] ?? dataUrl;
      setAttachment({ name: file.name, size: file.size, base64, mimeType: file.type || 'application/octet-stream' });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachWarning('');
    if (attachInputRef.current) attachInputRef.current.value = '';
  };

  const sendCampaign = async () => {
    const bodyHtml = blocksToHtml(blocks);
    if (!tournament || !subject || !bodyHtml.trim()) return;
    setSendingEmail(true);
    setSendResult(null);
    const createRes = await fetch(`/api/tournaments/${tournament.id}/email/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject, body: bodyHtml,
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
        attachment: attachment ? { name: attachment.name, content: attachment.base64, mimeType: attachment.mimeType } : undefined,
      }),
    });
    if (sendRes.ok) {
      const result = await sendRes.json();
      setSendResult({ ok: true, msg: `Sent to ${result.sent} recipients${result.failed > 0 ? `, ${result.failed} failed` : ''}` });
      setSubject('');
      setBlocks([{ id: '1', type: 'paragraph', text: '' }]);
      setAttachment(null);
      setAttachWarning('');
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
              {csvSuccess && (
                <div className="mt-3 text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg px-3 py-2">
                  {csvSuccess}
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
                  {/* Type override */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[var(--text-secondary)]">Import everyone as:</span>
                    <select
                      value={csvBulkType}
                      onChange={(e) => setCsvBulkType(e.target.value)}
                      className="border border-[var(--border)] rounded-lg px-2 py-1 text-xs bg-[var(--surface)] text-[var(--text-primary)]"
                    >
                      <option value="auto">Auto-detect from CSV</option>
                      <option value="player">🎯 Player</option>
                      <option value="volunteer">🙋 Volunteer</option>
                      <option value="invitee">✉️ Invitee</option>
                      <option value="other">• Other</option>
                    </select>
                  </div>

                  {/* Duplicate summary */}
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
                        <th className="text-left px-3 py-2 font-medium">Type</th>
                        <th className="text-left px-3 py-2 font-medium">Tags</th>
                        <th className="px-3 py-2 w-16"></th>
                      </tr></thead>
                      <tbody>
                        {csvPreview.slice(0, 15).map((r, i) => {
                          const isExisting = existingEmailSet.has(r.email.toLowerCase());
                          const skipped = csvSkipExisting && isExisting;
                          const effectiveType = csvBulkType === 'auto' ? (r.type || 'invitee') : csvBulkType;
                          return (
                            <tr key={i} className={`border-t border-[var(--border)] ${skipped ? 'opacity-40' : isExisting ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                              <td className="px-3 py-1.5">
                                <div className="font-medium">{r.name}</div>
                                <div className="text-[var(--text-muted)] truncate max-w-[14rem]">{r.email}</div>
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[effectiveType] || TYPE_COLORS.other}`}>
                                  {TYPE_ICONS[effectiveType]} {effectiveType}
                                </span>
                              </td>
                              <td className="px-3 py-1.5">
                                <div className="flex flex-wrap gap-1">
                                  {(r.tags ?? []).length > 0
                                    ? (r.tags ?? []).map((t) => <TagPill key={t} tag={t} />)
                                    : <span className="text-[var(--text-muted)]">—</span>}
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                {skipped
                                  ? <span className="text-[var(--text-muted)]">skip</span>
                                  : isExisting
                                    ? <span className="text-amber-600 dark:text-amber-400 font-medium">update</span>
                                    : <span className="text-green-600 dark:text-green-400 font-medium">new</span>}
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
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${TYPE_COLORS[r.type] || TYPE_COLORS.other}`}>
                                {TYPE_ICONS[r.type] || '•'} {r.type}
                              </span>
                              <span className="font-medium">{r.name}</span>
                            </div>
                            {(r.tags ?? []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5 ml-0.5">
                                {(r.tags ?? []).map((t) => <TagPill key={t} tag={t} />)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[var(--text-secondary)] hidden sm:table-cell">{r.email}</td>
                          <td className="px-4 py-2.5 hidden sm:table-cell"></td>
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

            {/* Message + block editor */}
            <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. You're Invited to the Seattle Open 2026!"
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-zinc-400" />
              </div>

              {/* Block editor header */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Message</label>
                {/* Mobile tab toggle */}
                <div className="flex md:hidden gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-0.5 text-xs">
                  <button onClick={() => setPreviewTab('edit')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${previewTab === 'edit' ? 'bg-foreground text-card' : 'text-[var(--text-secondary)]'}`}>
                    Edit
                  </button>
                  <button onClick={() => setPreviewTab('preview')}
                    className={`px-3 py-1 rounded-md font-medium transition-colors ${previewTab === 'preview' ? 'bg-foreground text-card' : 'text-[var(--text-secondary)]'}`}>
                    Preview
                  </button>
                </div>
              </div>

              {/* Two-column layout on md+, single-column on mobile */}
              <div className="md:grid md:grid-cols-2 md:gap-4">
                {/* Editor column */}
                <div className={`space-y-3 ${previewTab === 'preview' ? 'hidden md:block' : ''}`}>
                  {blocks.map((block, index) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      index={index}
                      total={blocks.length}
                      onChange={updateBlock}
                      onRemove={() => removeBlock(block.id)}
                      onMove={(dir) => moveBlock(block.id, dir)}
                    />
                  ))}

                  {/* Add block toolbar */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(['paragraph', 'heading', 'subheading', 'bullets', 'button', 'image', 'divider'] as BlockType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => addBlock(type)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-zinc-400 transition-colors"
                        title={`Add ${BLOCK_LABELS[type]} block`}
                      >
                        <span>{BLOCK_ICONS[type]}</span>
                        <span>{BLOCK_LABELS[type]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview column */}
                <div className={`md:max-h-[600px] md:overflow-y-auto ${previewTab === 'edit' ? 'hidden md:block' : ''}`}>
                  <div className="sticky top-0 hidden md:block pb-2">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Preview</p>
                  </div>
                  <EmailPreview blocks={blocks} tournamentName={tournament.name} />
                </div>
              </div>

              {/* Attachment */}
              <div className="border-t border-[var(--border)] pt-4 space-y-2">
                <p className="text-sm font-medium">📎 Attach a file</p>
                {attachment ? (
                  <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm">
                    <span className="text-[var(--text-primary)] font-medium truncate flex-1">{attachment.name}</span>
                    <span className="text-[var(--text-muted)] whitespace-nowrap text-xs">{(attachment.size / 1024).toFixed(1)} KB</span>
                    <button onClick={removeAttachment} className="text-red-400 hover:text-red-600 text-base leading-none shrink-0" title="Remove attachment">×</button>
                  </div>
                ) : (
                  <input
                    ref={attachInputRef}
                    type="file"
                    onChange={handleAttachFile}
                    className="block text-sm text-[var(--text-primary)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[var(--surface-card)] file:text-[var(--text-primary)] file:cursor-pointer hover:file:opacity-80 border border-[var(--border)] rounded-lg p-1"
                  />
                )}
                {attachWarning && (
                  <p className={`text-xs rounded-lg px-3 py-2 ${attachWarning.startsWith('Large') ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                    {attachWarning}
                  </p>
                )}
              </div>

              {sendResult && (
                <div className={`rounded-lg px-3 py-2 text-sm ${sendResult.ok ? 'bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                  {sendResult.msg}
                </div>
              )}

              <button
                onClick={sendCampaign}
                disabled={sending || !subject || blocks.every((b) => !blocksToHtml([b]).trim()) || sendRecipients.length === 0}
                className="bg-foreground text-card px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
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
