'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

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
  const inputClass = 'w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-zinc-400';

  return (
    <div
      className="group bg-card border border-border rounded-xl p-4 space-y-3"
      style={{ transition: 'box-shadow 0.15s' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {BLOCK_ICONS[block.type]} {BLOCK_LABELS[block.type]}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMove('up')} disabled={index === 0}
            className="w-6 h-6 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            title="Move up"
          >↑</button>
          <button
            onClick={() => onMove('down')} disabled={index === total - 1}
            className="w-6 h-6 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
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
              <span className="text-muted-foreground text-sm shrink-0">•</span>
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
            className="text-xs text-muted-foreground hover:text-foreground underline"
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
        <div className="text-center text-muted-foreground text-sm py-1 select-none">— Divider —</div>
      )}
    </div>
  );
}

/** Simplified live preview of how the email will look. */
function EmailPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f172a', padding: '24px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>Seattle Squash</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Seattle Squash Racquets Association</div>
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

type Tab = 'recipients' | 'compose' | 'history' | 'template';

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

function parseCSV(text: string): { name: string; email: string; tags?: string[] }[] {
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, ''));
  const emailIdx = headers.findIndex((h) => ['email', 'e-mail', 'email address'].includes(h));
  const nameIdx  = headers.findIndex((h) => ['name', 'full name', 'fullname', 'player name', 'player'].includes(h));
  const firstIdx = headers.findIndex((h) => ['first name', 'first', 'firstname'].includes(h));
  const lastIdx  = headers.findIndex((h) => ['last name', 'last', 'lastname', 'surname'].includes(h));
  const tagsIdx  = headers.findIndex((h) => ['tags', 'tag', 'group', 'category'].includes(h));

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

    // Tags can be separated by ; or , within the cell (e.g. "prior_tourney; non_WA")
    const tags = tagsIdx >= 0 && cells[tagsIdx]
      ? cells[tagsIdx].split(/[;,]/).map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];

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
  const [blocks, setBlocks] = useState<Block[]>([{ id: '1', type: 'paragraph', text: '' }]);
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [attachWarning, setAttachWarning] = useState<string>('');
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [sendTags, setSendTags] = useState<string[]>([]);
  const [sendMode, setSendMode] = useState<'all' | 'single'>('all');
  const [singleEmail, setSingleEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Test send
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Add single
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addTagInput, setAddTagInput] = useState('');

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const BG_PRESETS = [
    { label: 'Navy',     color: '#1a2332' },
    { label: 'Midnight', color: '#0f172a' },
    { label: 'Forest',   color: '#14532d' },
    { label: 'Crimson',  color: '#7f1d1d' },
    { label: 'Purple',   color: '#3b0764' },
    { label: 'Slate',    color: '#1e293b' },
    { label: 'Teal',     color: '#134e4a' },
    { label: 'Charcoal', color: '#27272a' },
  ];

  // Template settings
  const [tmpl, setTmpl] = useState({
    email_heading: '',
    email_subheading: '',
    email_header_bg: '#1a2332',
    email_header_image_url: '',
    email_footer_text: '',
  });
  const [tmplSaving, setTmplSaving] = useState(false);
  const [tmplSaved, setTmplSaved] = useState(false);
  const previewBg = tmpl.email_header_bg || '#1a2332';

  // CSV
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<{ name: string; email: string; tags?: string[] }[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvStatus, setCsvStatus] = useState<string>('');
  const [csvError, setCsvError] = useState<string>('');
  const [csvSkipExisting, setCsvSkipExisting] = useState(false);
  const [csvSuccess, setCsvSuccess] = useState<string>('');

  const refresh = async () => {
    const [r, c] = await Promise.all([
      fetch('/api/admin/email/recipients').then((x) => x.ok ? x.json() : []),
      fetch('/api/admin/email/campaigns').then((x) => x.ok ? x.json() : []),
    ]);
    setRecipients(r);
    setCampaigns(c);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    fetch('/api/site-settings').then((r) => r.ok ? r.json() : {}).then((s: Record<string, string | null>) => {
      setTmpl({
        email_heading: s.email_heading || '',
        email_subheading: s.email_subheading || '',
        email_header_bg: s.email_header_bg || '#1a2332',
        email_header_image_url: s.email_header_image_url || '',
        email_footer_text: s.email_footer_text || '',
      });
    });
  }, []);

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

  const saveTmpl = async () => {
    setTmplSaving(true); setTmplSaved(false);
    await fetch('/api/site-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tmpl),
    });
    setTmplSaving(false); setTmplSaved(true);
    setTimeout(() => setTmplSaved(false), 2500);
  };

  const startEdit = (r: Recipient) => {
    setEditingId(r.id); setEditName(r.name); setEditEmail(r.email);
    setEditTags(r.tags || []); setEditTagInput(''); setEditError(null);
  };
  const cancelEdit = () => { setEditingId(null); setEditTagInput(''); setEditError(null); };
  const addEditTag = () => {
    const t = editTagInput.trim().toLowerCase();
    if (t && !editTags.includes(t)) setEditTags([...editTags, t]);
    setEditTagInput('');
  };
  const saveEdit = async () => {
    if (!editingId) return;
    setEditSaving(true); setEditError(null);
    try {
      const res = await fetch('/api/admin/email/recipients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: editingId, name: editName, email: editEmail, tags: editTags }),
      });
      const data = await res.json();
      if (res.ok) {
        setRecipients((prev) => prev.map((r) => r.id === editingId ? data : r));
        setEditingId(null);
      } else {
        setEditError(data.error || `Save failed (${res.status})`);
      }
    } catch { setEditError('Network error'); }
    finally { setEditSaving(false); }
  };

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
    try { e.target.value = ''; } catch {}

    try {
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
        setCsvError('No valid rows found. CSV needs an "email" column, and emails must contain "@".');
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

  const existingEmailSet = new Set(recipients.map((r) => r.email.toLowerCase()));
  const csvNew = csvPreview.filter((r) => !existingEmailSet.has(r.email.toLowerCase()));
  const csvExisting = csvPreview.filter((r) => existingEmailSet.has(r.email.toLowerCase()));
  const csvToImport = csvSkipExisting ? csvNew : csvPreview;

  const importCsv = async () => {
    if (csvToImport.length === 0) return;
    setCsvImporting(true);
    const skipped = csvPreview.length - csvToImport.length;
    await fetch('/api/admin/email/recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(csvToImport),
    });
    setCsvPreview([]);
    setCsvStatus('');
    setCsvError('');
    setCsvSkipExisting(false);
    if (csvRef.current) csvRef.current.value = '';
    await refresh();
    setCsvImporting(false);
    const msg = skipped > 0
      ? `✓ Imported ${csvToImport.length} contacts (${skipped} existing skipped)`
      : `✓ ${csvToImport.length} contacts imported`;
    setCsvSuccess(msg);
    setTimeout(() => setCsvSuccess(''), 5000);
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

  const toggleSendTag = (tag: string) => {
    setSendTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const sendTest = async () => {
    const bodyHtml = blocksToHtml(blocks);
    if (!subject || !bodyHtml.trim() || !testEmail) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/email/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail, subject, body: bodyHtml,
          attachment: attachment ? { name: attachment.name, content: attachment.base64, mimeType: attachment.mimeType } : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, msg: `✓ Test sent to ${data.to}` });
      } else {
        setTestResult({ ok: false, msg: data.error || 'Test send failed' });
      }
    } catch {
      setTestResult({ ok: false, msg: 'Network error' });
    }
    setTestSending(false);
  };

  const sendCampaign = async () => {
    const bodyHtml = blocksToHtml(blocks);
    if (!subject || !bodyHtml.trim()) return;
    setSending(true);
    setSendResult(null);

    // Single-recipient mode — use test-send endpoint (no campaign record)
    if (sendMode === 'single') {
      if (!singleEmail) { setSendResult({ ok: false, msg: 'Enter a recipient email address' }); setSending(false); return; }
      try {
        const res = await fetch('/api/admin/email/test-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: singleEmail, subject, body: bodyHtml,
            attachment: attachment ? { name: attachment.name, content: attachment.base64, mimeType: attachment.mimeType } : undefined,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setSendResult({ ok: true, msg: `✓ Sent to ${data.to}` });
          setSubject(''); setBlocks([{ id: '1', type: 'paragraph', text: '' }]);
          setAttachment(null); setAttachWarning(''); setSingleEmail(''); setSendMode('all');
        } else {
          setSendResult({ ok: false, msg: data.error || 'Send failed' });
        }
      } catch {
        setSendResult({ ok: false, msg: 'Network error' });
      }
      setSending(false);
      return;
    }

    // Broadcast mode — create campaign record and send to list
    const createRes = await fetch('/api/admin/email/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body: bodyHtml, tags: sendTags }),
    });
    if (!createRes.ok) { setSendResult({ ok: false, msg: 'Failed to create campaign' }); setSending(false); return; }
    const campaign = await createRes.json();

    const sendRes = await fetch('/api/admin/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        tags: sendTags.length > 0 ? sendTags : undefined,
        attachment: attachment ? { name: attachment.name, content: attachment.base64, mimeType: attachment.mimeType } : undefined,
      }),
    });

    if (sendRes.ok) {
      const result = await sendRes.json();
      setSendResult({ ok: true, msg: `Sent to ${result.sent} recipients${result.failed > 0 ? `, ${result.failed} failed` : ''}` });
      setSubject(''); setBlocks([{ id: '1', type: 'paragraph', text: '' }]);
      setAttachment(null); setAttachWarning(''); setSendTags([]);
      await refresh();
    } else {
      const err = await sendRes.json();
      setSendResult({ ok: false, msg: err.error || 'Send failed' });
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">&larr; Dashboard</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">Email Marketing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {recipients.filter((r) => r.subscribed).length} subscribed · {recipients.length} total
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6">
          {(['recipients', 'compose', 'history', 'template'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-surface'}`}>
              {t === 'recipients' ? `Recipients (${recipients.length})` : t === 'compose' ? 'Compose' : t === 'history' ? 'History' : '🎨 Template'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3 py-4" aria-label="Loading email data">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-surface rounded w-1/3 mb-2" />
                <div className="h-3 bg-surface rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : tab === 'recipients' ? (
          <div className="space-y-5">
            {/* Search + tag filter */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..."
                aria-label="Search recipients"
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm" />
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
                aria-label="Filter by tag"
                className="border border-border rounded-lg px-3 py-2 text-sm">
                <option value="">All Tags</option>
                {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* CSV Import */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-1">Bulk Import via CSV</h3>
              <p className="text-xs text-muted-foreground mb-3">Required: <strong>email</strong>. Optional: <strong>name</strong> (or <strong>player</strong>), <strong>tags</strong> (semicolon-separated, e.g. <em>members;newsletter</em>).</p>

              {/* Native label+input — most reliable file-picker pattern across browsers. */}
              <div className="flex flex-wrap gap-2 items-center">
                <label
                  htmlFor="admin-csv-file-input"
                  className="inline-block bg-surface hover:opacity-80 text-foreground px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-opacity select-none"
                >
                  Choose CSV
                </label>
                <input
                  id="admin-csv-file-input"
                  ref={csvRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleCsvFile}
                  className="sr-only"
                  aria-label="Choose CSV file"
                />
                {csvPreview.length > 0 && (
                  <>
                    <button onClick={importCsv} disabled={csvImporting || csvToImport.length === 0}
                      className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                      {csvImporting ? 'Importing...' : `Import ${csvToImport.length}`}
                    </button>
                    <button onClick={() => { setCsvPreview([]); setCsvStatus(''); setCsvError(''); setCsvSkipExisting(false); if (csvRef.current) csvRef.current.value = ''; }}
                      className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                  </>
                )}
              </div>

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
                  {csvExisting.length > 0 ? (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 space-y-2">
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        <strong>{csvNew.length} new</strong> · <strong>{csvExisting.length} already in list</strong>
                        {!csvSkipExisting && <span className="text-amber-600 dark:text-amber-400"> — existing contacts will have their tags merged and name updated</span>}
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input type="checkbox" checked={csvSkipExisting} onChange={(e) => setCsvSkipExisting(e.target.checked)} className="rounded" />
                        <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">Skip existing — only import {csvNew.length} new contact{csvNew.length !== 1 ? 's' : ''}</span>
                      </label>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground"><strong>{csvPreview.length}</strong> new contacts — none are in the list yet</p>
                  )}
                  <div className="max-h-48 overflow-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-surface">
                        <th className="text-left px-3 py-2 font-medium">Name</th>
                        <th className="text-left px-3 py-2 font-medium">Email</th>
                        <th className="text-left px-3 py-2 font-medium">Tags</th>
                        <th className="px-3 py-2 w-20"></th>
                      </tr></thead>
                      <tbody>
                        {csvPreview.slice(0, 12).map((r, i) => {
                          const isExisting = existingEmailSet.has(r.email.toLowerCase());
                          const skipped = csvSkipExisting && isExisting;
                          return (
                            <tr key={i} className={`border-t border-border ${skipped ? 'opacity-40' : isExisting ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                              <td className="px-3 py-1.5 font-medium">{r.name}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{r.email}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{(r.tags || []).join(', ') || '—'}</td>
                              <td className="px-3 py-1.5 text-right">
                                {skipped ? <span className="text-muted-foreground">skip</span>
                                  : isExisting ? <span className="text-amber-600 dark:text-amber-400 font-medium">update</span>
                                  : <span className="text-green-600 dark:text-green-400 font-medium">new</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {csvPreview.length > 12 && <tr><td colSpan={4} className="px-3 py-1.5 text-muted-foreground">...and {csvPreview.length - 12} more</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Add single */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-3">Add Single Recipient</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input id="add-name" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name"
                  aria-label="Recipient name"
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm" />
                <input id="add-email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Email"
                  aria-label="Recipient email"
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm" />
                <input id="add-tags" value={addTagInput} onChange={(e) => setAddTagInput(e.target.value)} placeholder="Tags (comma-separated)"
                  aria-label="Recipient tags"
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm" />
                <button onClick={addRecipient}
                  className="bg-foreground text-background px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">Add</button>
              </div>
            </div>

            {/* Recipients table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {filteredRecipients.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto mb-3 text-dim" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  <p className="text-muted-foreground text-sm">No recipients found.</p>
                  {(search || tagFilter) && <p className="text-dim text-xs mt-1">Try adjusting your search or tag filter.</p>}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="bg-surface border-b border-border">
                    <th className="text-left px-4 py-3 font-medium">Name / Tags</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                    <th className="px-4 py-3 w-28"></th>
                  </tr></thead>
                  <tbody>
                    {filteredRecipients.map((r) => (
                      editingId === r.id ? (
                        <tr key={r.id} className="border-b border-border bg-amber-50 dark:bg-amber-950/20">
                          <td colSpan={3} className="px-4 py-3">
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap gap-2">
                                <input
                                  id={`edit-name-${r.id}`}
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  placeholder="Name"
                                  aria-label="Edit recipient name"
                                  className="border border-border rounded-lg px-2 py-1.5 text-sm flex-1 min-w-32" />
                                <input
                                  id={`edit-email-${r.id}`}
                                  type="email"
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  placeholder="Email"
                                  aria-label="Edit recipient email"
                                  className="border border-border rounded-lg px-2 py-1.5 text-sm flex-1 min-w-40" />
                              </div>
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {editTags.map((t) => (
                                  <span key={t} className="inline-flex items-center gap-1 bg-surface text-foreground text-xs px-2 py-0.5 rounded-full">
                                    {t}
                                    <button
                                      onClick={() => setEditTags(editTags.filter((x) => x !== t))}
                                      aria-label={`Remove tag ${t}`}
                                      className="text-muted-foreground hover:text-foreground">×</button>
                                  </span>
                                ))}
                                <input
                                  id={`edit-tag-input-${r.id}`}
                                  value={editTagInput}
                                  onChange={(e) => setEditTagInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEditTag(); } }}
                                  placeholder="Add tag, press Enter…"
                                  aria-label="Add tag"
                                  className="border border-border rounded-lg px-2 py-1 text-xs w-40"
                                />
                                {allTags.filter((t) => !editTags.includes(t)).map((t) => (
                                  <button key={t} onClick={() => setEditTags([...editTags, t])}
                                    className="text-xs text-muted-foreground hover:text-foreground border border-dashed border-border px-1.5 py-0.5 rounded-full">
                                    + {t}
                                  </button>
                                ))}
                              </div>
                              {editError && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{editError}</p>}
                              <div className="flex gap-2">
                                <button onClick={saveEdit} disabled={editSaving}
                                  className="bg-foreground text-background px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                                  {editSaving ? 'Saving…' : 'Save'}
                                </button>
                                <button onClick={cancelEdit} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={r.id} className="border-b border-border hover:bg-surface">
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground sm:hidden">{r.email}</div>
                            {(r.tags || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(r.tags || []).map((tag) => (
                                  <span key={tag} className="text-xs bg-surface text-foreground px-1.5 py-0.5 rounded-full">{tag}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{r.email}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => startEdit(r)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                              <button onClick={() => removeRecipient(r.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                            </div>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : tab === 'compose' ? (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            {/* Targeting */}
            <div>
              <label className="block text-sm font-medium mb-2">Send To</label>
              <div className="flex flex-wrap gap-2">
                {/* Broadcast options */}
                <button onClick={() => { setSendMode('all'); setSendTags([]); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${sendMode === 'all' && sendTags.length === 0 ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-foreground hover:border-foreground'}`}>
                  Everyone ({recipients.filter((r) => r.subscribed).length})
                </button>
                {allTags.map((tag) => {
                  const count = recipients.filter((r) => r.subscribed && (r.tags || []).includes(tag)).length;
                  const active = sendMode === 'all' && sendTags.includes(tag);
                  return (
                    <button key={tag} onClick={() => { setSendMode('all'); toggleSendTag(tag); }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${active ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-foreground hover:border-foreground'}`}>
                      {tag} ({count})
                    </button>
                  );
                })}
                {/* Single person */}
                <button onClick={() => setSendMode(sendMode === 'single' ? 'all' : 'single')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${sendMode === 'single' ? 'bg-blue-600 text-white border-blue-600' : 'bg-card border-border text-foreground hover:border-foreground'}`}>
                  Single person
                </button>
              </div>
              {sendMode === 'single' && (
                <div className="mt-3">
                  <input
                    type="email"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    aria-label="Single recipient email"
                    className="w-full sm:w-80 border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">Sends directly to this address — no campaign record created.</p>
                </div>
              )}
              {sendMode === 'all' && sendTags.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">Sending to recipients tagged: {sendTags.join(', ')}</p>
              )}
            </div>

            <div>
              <label htmlFor="compose-subject" className="block text-sm font-medium mb-1">Subject</label>
              <input id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Seattle Squash — Spring Season Update"
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm" />
            </div>

            {/* Block editor header */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Message</label>
              {/* Mobile tab toggle */}
              <div className="flex md:hidden gap-1 bg-surface border border-border rounded-lg p-0.5 text-xs">
                <button onClick={() => setPreviewTab('edit')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${previewTab === 'edit' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>
                  Edit
                </button>
                <button onClick={() => setPreviewTab('preview')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors ${previewTab === 'preview' ? 'bg-foreground text-background' : 'text-muted-foreground'}`}>
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-zinc-400 transition-colors"
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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
                </div>
                <EmailPreview blocks={blocks} />
              </div>
            </div>

            {/* Attachment */}
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-sm font-medium">📎 Attach a file</p>
              {attachment ? (
                <div className="flex items-center gap-3 bg-surface border border-border rounded-lg px-3 py-2.5 text-sm">
                  <span className="text-foreground font-medium truncate flex-1">{attachment.name}</span>
                  <span className="text-muted-foreground whitespace-nowrap text-xs">{(attachment.size / 1024).toFixed(1)} KB</span>
                  <button onClick={removeAttachment} className="text-red-400 hover:text-red-600 text-base leading-none shrink-0" title="Remove attachment">×</button>
                </div>
              ) : (
                <input
                  ref={attachInputRef}
                  type="file"
                  onChange={handleAttachFile}
                  className="block text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-card file:text-foreground file:cursor-pointer hover:file:opacity-80 border border-border rounded-lg p-1"
                />
              )}
              {attachWarning && (
                <p className={`text-xs rounded-lg px-3 py-2 ${attachWarning.startsWith('Large') ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                  {attachWarning}
                </p>
              )}
            </div>

            {sendMode === 'all' && (
              <div className="bg-surface rounded-lg p-4 text-sm text-muted-foreground">
                Sending to <strong className="text-foreground">{sendTargetCount}</strong> subscribed recipient{sendTargetCount !== 1 ? 's' : ''}{sendTags.length > 0 ? ` tagged "${sendTags.join('", "')}"` : ''}.
              </div>
            )}

            {sendResult && (
              <div className={`rounded-lg px-3 py-2 text-sm ${sendResult.ok ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                {sendResult.msg}
              </div>
            )}

            <button
              onClick={sendCampaign}
              disabled={
                sending || !subject || blocks.every((b) => !blocksToHtml([b]).trim()) ||
                (sendMode === 'all' && sendTargetCount === 0) ||
                (sendMode === 'single' && !singleEmail)
              }
              className="bg-foreground text-background px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {sending
                ? 'Sending…'
                : sendMode === 'single'
                ? `Send to ${singleEmail || '…'}`
                : `Send to ${sendTargetCount} Recipient${sendTargetCount !== 1 ? 's' : ''}`}
            </button>

            {/* ── Test send ──────────────────────────────────── */}
            <div className="border-t border-border pt-4 mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Send a Test</p>
              <div className="flex flex-col sm:flex-row gap-2 items-start">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => { setTestEmail(e.target.value); setTestResult(null); }}
                  placeholder="your@email.com"
                  aria-label="Test email address"
                  className="flex-1 sm:max-w-xs border border-border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={sendTest}
                  disabled={testSending || !subject || blocks.every((b) => !blocksToHtml([b]).trim()) || !testEmail}
                  className="whitespace-nowrap bg-surface border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-50 transition-opacity"
                >
                  {testSending ? 'Sending…' : 'Send Test →'}
                </button>
              </div>
              {testResult && (
                <p className={`mt-2 text-xs ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {testResult.msg}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1.5">Uses current subject + message blocks. No campaign record — just a preview in your inbox.</p>
            </div>
          </div>
        ) : tab === 'history' ? (
          <div className="space-y-4">
            {campaigns.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <svg className="mx-auto mb-3 text-dim" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <p className="text-muted-foreground text-sm">No campaigns sent yet.</p>
                <p className="text-dim text-xs mt-1">Go to Compose to send your first campaign.</p>
              </div>
            ) : campaigns.map((c) => (
              <div key={c.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{c.subject}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.body}</p>
                    {c.tags && c.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {c.tags.map((tag) => (
                          <span key={tag} className="text-xs bg-surface text-foreground px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.status === 'sent' ? 'bg-green-100 text-green-700' : c.status === 'draft' ? 'bg-surface text-muted-foreground' : c.status === 'sending' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                      {c.status}
                    </span>
                    {c.sent_at && <p className="text-xs text-muted-foreground mt-1">{new Date(c.sent_at).toLocaleDateString()}</p>}
                    {c.sent_count > 0 && <p className="text-xs text-muted-foreground">{c.sent_count} sent</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'template' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Controls */}
                <div className="space-y-5">
                  <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-semibold">Header Text</h3>
                    <div>
                      <label htmlFor="tmpl-heading" className="block text-xs font-medium text-muted-foreground mb-1">Heading</label>
                      <input id="tmpl-heading" value={tmpl.email_heading}
                        onChange={(e) => setTmpl({ ...tmpl, email_heading: e.target.value })}
                        placeholder="Seattle Squash (default)"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label htmlFor="tmpl-subheading" className="block text-xs font-medium text-muted-foreground mb-1">Subheading</label>
                      <input id="tmpl-subheading" value={tmpl.email_subheading}
                        onChange={(e) => setTmpl({ ...tmpl, email_subheading: e.target.value })}
                        placeholder="Seattle Squash (default)"
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <h3 className="font-semibold">Header Background</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {BG_PRESETS.map((p) => (
                        <button key={p.color} onClick={() => setTmpl({ ...tmpl, email_header_bg: p.color })}
                          title={p.label}
                          aria-label={`Set header background to ${p.label}`}
                          className="relative h-10 rounded-lg border-2 transition-all"
                          style={{ background: p.color, borderColor: tmpl.email_header_bg === p.color ? 'white' : 'transparent', outline: tmpl.email_header_bg === p.color ? `2px solid ${p.color}` : 'none' }}>
                          {tmpl.email_header_bg === p.color && (
                            <span className="absolute inset-0 flex items-center justify-center text-white text-sm">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="tmpl-color-picker" className="text-xs text-muted-foreground">Custom hex:</label>
                      <input id="tmpl-color-picker" type="color" value={tmpl.email_header_bg || '#1a2332'}
                        onChange={(e) => setTmpl({ ...tmpl, email_header_bg: e.target.value })}
                        className="h-8 w-12 rounded border border-border cursor-pointer" />
                      <input id="tmpl-color-hex" value={tmpl.email_header_bg}
                        onChange={(e) => setTmpl({ ...tmpl, email_header_bg: e.target.value })}
                        placeholder="#1a2332"
                        aria-label="Header background hex value"
                        className="w-28 border border-border rounded-lg px-2 py-1.5 text-xs font-mono" />
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <h3 className="font-semibold">Header Image</h3>
                    <p className="text-xs text-muted-foreground">Logo or banner shown above the heading. Use a URL from Supabase Storage or any hosted image.</p>
                    <input id="tmpl-header-image" value={tmpl.email_header_image_url}
                      onChange={(e) => setTmpl({ ...tmpl, email_header_image_url: e.target.value })}
                      placeholder="https://… (leave blank for none)"
                      aria-label="Header image URL"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
                    {tmpl.email_header_image_url && (
                      <img src={tmpl.email_header_image_url} alt="preview"
                        className="h-16 object-contain rounded border border-border" />
                    )}
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <h3 className="font-semibold">Footer Text</h3>
                    <textarea id="tmpl-footer" value={tmpl.email_footer_text}
                      onChange={(e) => setTmpl({ ...tmpl, email_footer_text: e.target.value })}
                      rows={2}
                      placeholder="Seattle Squash Racquets Association&#10;P.O. Box 665, Seattle, WA 98111"
                      aria-label="Email footer text"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-semibold mb-2">Insert Images in Messages</h3>
                    <p className="text-xs text-muted-foreground">In the Compose body, paste an image URL on its own line wrapped like this and it will render full-width in the email:</p>
                    <code className="block mt-2 bg-surface border border-border rounded px-3 py-2 text-xs font-mono text-foreground">
                      {'[[image:https://your-image-url.com/photo.jpg]]'}
                    </code>
                  </div>

                  <button onClick={saveTmpl} disabled={tmplSaving}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${tmplSaved ? 'bg-green-600 text-white' : 'bg-foreground text-background hover:opacity-90'} disabled:opacity-50`}>
                    {tmplSaving ? 'Saving…' : tmplSaved ? '✓ Saved' : 'Save Template'}
                  </button>
                </div>

                {/* Live preview */}
                <div className="sticky top-4">
                  <p className="text-xs font-medium text-dim uppercase tracking-wide mb-2">Preview</p>
                  <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                    <div style={{ background: previewBg, padding: '20px 24px', textAlign: 'center' }}>
                      {tmpl.email_header_image_url && (
                        <img src={tmpl.email_header_image_url} alt=""
                          style={{ display: 'block', maxWidth: 80, height: 'auto', margin: '0 auto 10px', borderRadius: 4 }} />
                      )}
                      <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>
                        {tmpl.email_heading || 'Seattle Squash'}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 4 }}>
                        {tmpl.email_subheading || 'Seattle Squash'}
                      </div>
                    </div>
                    <div style={{ background: 'white', padding: '20px 24px' }}>
                      <div style={{ height: 10, background: '#e4e4e7', borderRadius: 4, marginBottom: 8 }} />
                      <div style={{ height: 10, background: '#e4e4e7', borderRadius: 4, width: '80%', marginBottom: 8 }} />
                      <div style={{ height: 10, background: '#e4e4e7', borderRadius: 4, width: '60%' }} />
                    </div>
                    <div style={{ background: '#f4f4f5', padding: '12px 24px', textAlign: 'center', fontSize: 11, color: '#71717a' }}>
                      {tmpl.email_footer_text || 'Seattle Squash Racquets Association · P.O. Box 665, Seattle, WA 98111'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        ) : null}
      </main>
    </div>
  );
}
