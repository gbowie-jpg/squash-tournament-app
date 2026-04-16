'use client';

import { useState, useRef } from 'react';

type PlayerRow = {
  name: string;
  draw?: string;
  seed?: number;
  club?: string;
  email?: string;
  phone?: string;
};

type FieldKey = 'name' | 'firstName' | 'lastName' | 'draw' | 'seed' | 'club' | 'email' | 'phone' | 'skip';

// Auto-detect column mapping from header name
function guessField(header: string): FieldKey {
  const h = header.toLowerCase().trim();
  if (h === 'name' || h === 'player' || h === 'player name' || h === 'full name' || h === 'fullname') return 'name';
  if (h === 'first name' || h === 'first' || h === 'firstname' || h === 'fname' || h === 'given name') return 'firstName';
  if (h === 'last name' || h === 'last' || h === 'lastname' || h === 'lname' || h === 'surname' || h === 'family name') return 'lastName';
  if (h === 'draw' || h === 'event' || h === 'division' || h === 'category' || h === 'event name' || h === 'draw name') return 'draw';
  if (h === 'seed' || h === 'seeding' || h === 'seed #' || h === 'seed number') return 'seed';
  if (h === 'club' || h === 'home club' || h === 'club name' || h === 'affiliation' || h === 'team') return 'club';
  if (h === 'email' || h === 'e-mail' || h === 'email address') return 'email';
  if (h === 'phone' || h === 'mobile' || h === 'phone number' || h === 'cell') return 'phone';
  return 'skip';
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  // Strip UTF-8 BOM that Excel/Google Sheets often add to CSV exports.
  // Without this, the first header becomes "\uFEFFplayer" and auto-mapping fails.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parser that handles quoted fields
  const parseLine = (line: string): string[] => {
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
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter((r) => r.some((cell) => cell));
  return { headers, rows };
}

type DupFlag = { type: 'exact'; otherIdx: number } | { type: 'email'; otherIdx: number };

function detectDuplicates(players: PlayerRow[]): Map<number, DupFlag> {
  const flags = new Map<number, DupFlag>();
  const nameEmailSeen = new Map<string, number>(); // "name||email" → first index
  const emailSeen = new Map<string, number>();      // email → first index

  players.forEach((p, i) => {
    const normName = p.name.toLowerCase().trim();
    const normEmail = p.email?.toLowerCase().trim() ?? '';

    // Exact duplicate: same name AND same email
    if (normEmail) {
      const key = `${normName}||${normEmail}`;
      const prev = nameEmailSeen.get(key);
      if (prev !== undefined) {
        flags.set(i, { type: 'exact', otherIdx: prev });
        return; // skip shared-email check for exact dups
      }
      nameEmailSeen.set(key, i);
    }

    // Shared email: same email, different name
    if (normEmail) {
      const prev = emailSeen.get(normEmail);
      if (prev !== undefined) {
        const prevName = players[prev].name.toLowerCase().trim();
        if (prevName !== normName) {
          flags.set(i, { type: 'email', otherIdx: prev });
        }
      } else {
        emailSeen.set(normEmail, i);
      }
    }
  });

  return flags;
}

interface CsvUploadProps {
  tournamentId: string;
  onImport: (players: PlayerRow[]) => void;
}

export default function CsvUpload({ tournamentId, onImport }: CsvUploadProps) {
  const [step, setStep] = useState<'idle' | 'mapping' | 'preview'>('idle');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-selected if needed
    e.target.value = '';
    setImportError(null);

    // Use File.text() with a timeout — more reliable than FileReader,
    // and the timeout catches the case where the file is in a cloud-synced
    // folder (iCloud, Dropbox, etc.) and internet is unavailable.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out — file may be stored in a cloud folder that is currently offline. Try copying it to your Desktop first.')), 8000)
    );

    Promise.race([file.text(), timeout])
      .then((text) => {
        const { headers: h, rows: r } = parseCSV(text as string);
        if (h.length === 0) {
          setImportError('File appears empty or could not be parsed');
          return;
        }
        setHeaders(h);
        setRows(r);
        setMapping(h.map(guessField));
        setExcludedIndices(new Set());
        setStep('mapping');
      })
      .catch((err: Error) => {
        setImportError(err.message || 'Could not read file — try again');
      });
  };

  const buildPlayers = (): PlayerRow[] => {
    return rows.map((row) => {
      const obj: Record<string, string> = {};
      mapping.forEach((field, i) => {
        if (field !== 'skip' && row[i]) {
          obj[field] = row[i];
        }
      });

      // Combine first/last name if separate
      let name = obj.name || '';
      if (!name && (obj.firstName || obj.lastName)) {
        name = [obj.firstName, obj.lastName].filter(Boolean).join(' ');
      }
      if (!name) return null;

      return {
        name,
        draw: obj.draw || undefined,
        seed: obj.seed ? parseInt(obj.seed) || undefined : undefined,
        club: obj.club || undefined,
        email: obj.email || undefined,
        phone: obj.phone || undefined,
      };
    }).filter(Boolean) as PlayerRow[];
  };

  const handleImport = async () => {
    const players = previewPlayers; // excludedIndices already filtered out
    if (players.length === 0) return;
    setImporting(true);
    setImportError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(players),
      });
      if (res.ok) {
        const imported = await res.json();
        onImport(imported);
        setStep('idle');
        setHeaders([]);
        setRows([]);
      } else {
        const err = await res.json().catch(() => ({}));
        setImportError(err.error || `Import failed (${res.status}) — please try again`);
      }
    } catch {
      setImportError('Network error — please try again');
    } finally {
      setImporting(false);
    }
  };

  const allPlayers = step === 'mapping' ? buildPlayers() : [];
  const previewPlayers = allPlayers.filter((_, i) => !excludedIndices.has(i));

  // Detect on allPlayers (pre-exclusion) so warnings always reflect what's in the file
  const dupFlags = detectDuplicates(allPlayers);
  // Only count flags not already excluded
  const activeDupFlags = new Map([...dupFlags.entries()].filter(([i]) => !excludedIndices.has(i)));
  const exactDups = [...activeDupFlags.values()].filter((f) => f.type === 'exact').length;
  const emailDups = [...activeDupFlags.values()].filter((f) => f.type === 'email').length;
  const fieldOptions: { value: FieldKey; label: string }[] = [
    { value: 'skip', label: '— Skip —' },
    { value: 'name', label: 'Full Name' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'draw', label: 'Draw / Event' },
    { value: 'seed', label: 'Seed' },
    { value: 'club', label: 'Club' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
  ];

  if (step === 'idle') {
    return (
      <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
        {/* Input lives outside the button — stable DOM node, not affected by re-renders */}
        <input
          ref={fileRef}
          type="file"
          onChange={handleFile}
          className="hidden"
          aria-label="Choose CSV file to upload"
        />
        <p className="text-sm text-muted-foreground mb-3">Upload a CSV file to bulk-add players</p>
        <p className="text-xs text-muted-foreground mb-4">Works with ClubLocker exports, or any CSV with player names</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-block bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 cursor-pointer transition-colors"
          aria-label="Choose CSV file to upload"
        >
          Choose CSV File
        </button>
        {importError && (
          <p className="mt-3 text-xs text-red-500">{importError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      {/* Column mapping */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Map Columns</h3>
          <button onClick={() => { setStep('idle'); if (fileRef.current) fileRef.current.value = ''; }} className="text-xs text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {rows.length} rows found. Confirm the column mapping below:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {headers.map((h, i) => (
            <div key={i}>
              <p className="text-xs text-muted-foreground mb-1 truncate" title={h}>{h}</p>
              <select
                value={mapping[i]}
                onChange={(e) => {
                  const newMapping = [...mapping];
                  newMapping[i] = e.target.value as FieldKey;
                  setMapping(newMapping);
                }}
                className={`w-full border rounded-lg px-2 py-1.5 text-xs ${
                  mapping[i] === 'skip' ? 'border-border text-muted-foreground' : 'border-border text-foreground font-medium ring-1 ring-foreground/20'
                }`}
              >
                {fieldOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {rows[0]?.[i] && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">e.g. {rows[0][i]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <h3 className="font-semibold">Preview ({previewPlayers.length} players)</h3>
          {activeDupFlags.size > 0 && (
            <button
              onClick={() => setExcludedIndices((prev) => new Set([...prev, ...activeDupFlags.keys()]))}
              className="text-xs bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 px-3 py-1 rounded-lg font-medium"
            >
              Remove {activeDupFlags.size} duplicate{activeDupFlags.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Duplicate summary banner */}
        {activeDupFlags.size > 0 && (
          <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-0.5">
            {exactDups > 0 && (
              <p>⚠ <strong>{exactDups}</strong> exact duplicate{exactDups !== 1 ? 's' : ''} (same name + email) — highlighted in red below</p>
            )}
            {emailDups > 0 && (
              <p>⚠ <strong>{emailDups}</strong> shared email address{emailDups !== 1 ? 'es' : ''} — highlighted in orange below</p>
            )}
          </div>
        )}

        <div className="max-h-60 overflow-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Draw</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Seed</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Club</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-48">Email</th>
                <th className="px-3 py-2 w-6" />
              </tr>
            </thead>
            <tbody>
              {previewPlayers.slice(0, 30).map((p, previewIdx) => {
                // Map preview index back to allPlayers index for flag lookup
                const allIdx = allPlayers.indexOf(p);
                const flag = activeDupFlags.get(allIdx);
                const rowBg = flag?.type === 'exact'
                  ? 'bg-red-50'
                  : flag?.type === 'email'
                  ? 'bg-amber-50'
                  : '';
                return (
                  <tr key={previewIdx} className={`border-b border-border ${rowBg}`}>
                    <td className="px-3 py-1.5 font-medium">{p.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.draw || '—'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.seed || '—'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.club || '—'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[12rem]">{p.email || '—'}</td>
                    <td className="px-2 py-1.5 text-center">
                      {flag?.type === 'exact' && (
                        <span title={`Exact duplicate of row ${flag.otherIdx + 1}`} className="text-red-500 font-bold cursor-help">✕</span>
                      )}
                      {flag?.type === 'email' && (
                        <span title={`Email shared with row ${flag.otherIdx + 1} (${allPlayers[flag.otherIdx]?.name})`} className="text-amber-500 cursor-help">⚠</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {previewPlayers.length > 30 && (
            <p className="text-xs text-muted-foreground text-center py-2">...and {previewPlayers.length - 30} more</p>
          )}
        </div>
      </div>

      {/* Import button */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleImport}
          disabled={importing || previewPlayers.length === 0}
          className="bg-foreground text-background px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? 'Importing...' : `Import ${previewPlayers.length} Players`}
        </button>
        {previewPlayers.length === 0 && !importError && (
          <p className="text-xs text-red-500">
            No valid players found. Make sure at least one column is mapped to <strong>Full Name</strong> (or First + Last Name).
          </p>
        )}
        {importError && (
          <p className="text-xs text-red-500">{importError}</p>
        )}
      </div>
    </div>
  );
}
