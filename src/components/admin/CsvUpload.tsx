'use client';

import { useState, useRef } from 'react';

type PlayerRow = {
  name: string;
  first_name?: string;
  last_name?: string;
  draw?: string;
  seed?: number;
  club?: string;
  email?: string;
  phone?: string;
  club_locker_id?: string;
  gender?: string;
  city?: string;
  rating?: number;
  ranking?: number;
};

type FieldKey =
  | 'name' | 'firstName' | 'lastName' | 'lastFirst'
  | 'draw' | 'seed' | 'club' | 'email' | 'phone'
  | 'clubLockerId' | 'gender' | 'city' | 'rating' | 'ranking'
  | 'skip';

// Auto-detect column mapping from header name
function guessField(header: string): FieldKey {
  const h = header.toLowerCase().trim().replace(/\s+/g, '');
  // Names
  if (['name','player','playername','fullname'].includes(h) || h === 'player name' || h === 'full name') return 'name';
  if (['firstname','fname','givenname','first'].includes(h) || h === 'first name' || h === 'given name') return 'firstName';
  if (['lastname','lname','surname','familyname','last'].includes(h) || h === 'last name' || h === 'family name') return 'lastName';
  if (['lastfirst','playerlastfirst'].includes(h) || h === 'last, first' || h === 'last first') return 'lastFirst';
  // Draw / event
  if (['draw','event','division','category','eventname','drawname'].includes(h) || h === 'event name' || h === 'draw name') return 'draw';
  // Seed
  if (['seed','seeding'].includes(h) || h === 'seed #' || h === 'seed number') return 'seed';
  // Club
  if (['club','homeclub','clubname','affiliation','team'].includes(h) || h === 'home club' || h === 'club name') return 'club';
  // Contact
  if (['email','e-mail','emailaddress','playeremail'].includes(h) || h === 'email address') return 'email';
  if (['phone','mobile','phonenumber','cell'].includes(h) || h === 'phone number') return 'phone';
  // Club Locker extended fields
  if (['playerid','clublockerid'].includes(h)) return 'clubLockerId';
  if (['playersex','sex','gender'].includes(h)) return 'gender';
  if (['playercity','city'].includes(h)) return 'city';
  if (['playerseedingrating','playerorderrating','rating','playerrating'].includes(h) || h === 'player rating') return 'rating';
  if (['playerranking','ranking'].includes(h)) return 'ranking';
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

type DupFlag =
  | { type: 'exact'; otherIdx: number }
  | { type: 'email'; otherIdx: number }
  | { type: 'similar'; otherIdx: number }
  | { type: 'existing'; existingName: string };

type ExistingPlayer = { name: string; email?: string | null };

function nameTokens(name: string): string[] {
  return name.toLowerCase().trim().split(/\s+/);
}

function isSimilarName(a: string, b: string): boolean {
  const tA = nameTokens(a);
  const tB = nameTokens(b);
  const [shorter, longer] = tA.length <= tB.length ? [tA, tB] : [tB, tA];
  // Require at least 2 tokens so single-word names don't false-positive
  if (shorter.length < 2) return false;
  return shorter.every((t) => longer.includes(t));
}

function detectDuplicates(
  players: PlayerRow[],
  existing: ExistingPlayer[] = [],
): Map<number, DupFlag> {
  const flags = new Map<number, DupFlag>();
  const nameEmailSeen = new Map<string, number>();
  const emailSeen = new Map<string, number>();

  // Build lookup sets from already-imported players
  const existingEmails = new Set(existing.map((p) => p.email?.toLowerCase().trim()).filter(Boolean) as string[]);
  const existingNames = new Map(existing.map((p) => [p.name.toLowerCase().trim(), p.name]));

  players.forEach((p, i) => {
    const normName = p.name.toLowerCase().trim();
    const normEmail = p.email?.toLowerCase().trim() ?? '';

    // Already in the tournament — email match takes priority
    if (normEmail && existingEmails.has(normEmail)) {
      flags.set(i, { type: 'existing', existingName: existing.find((e) => e.email?.toLowerCase().trim() === normEmail)?.name ?? normName });
      return;
    }
    if (existingNames.has(normName)) {
      flags.set(i, { type: 'existing', existingName: existingNames.get(normName)! });
      return;
    }

    // Exact duplicate within this batch
    if (normEmail) {
      const key = `${normName}||${normEmail}`;
      const prev = nameEmailSeen.get(key);
      if (prev !== undefined) { flags.set(i, { type: 'exact', otherIdx: prev }); return; }
      nameEmailSeen.set(key, i);
    }

    // Shared email, different name
    if (normEmail) {
      const prev = emailSeen.get(normEmail);
      if (prev !== undefined) {
        if (players[prev].name.toLowerCase().trim() !== normName) {
          flags.set(i, { type: 'email', otherIdx: prev }); return;
        }
      } else {
        emailSeen.set(normEmail, i);
      }
    }
  });

  // Similar name check within batch
  for (let i = 0; i < players.length; i++) {
    if (flags.has(i)) continue;
    for (let j = 0; j < i; j++) {
      if (flags.has(j)) continue;
      if (isSimilarName(players[i].name, players[j].name)) {
        flags.set(i, { type: 'similar', otherIdx: j }); break;
      }
    }
  }

  return flags;
}

interface CsvUploadProps {
  tournamentId: string;
  existingPlayers?: ExistingPlayer[];
  onImport: (players: PlayerRow[]) => void;
}

export default function CsvUpload({ tournamentId, existingPlayers = [], onImport }: CsvUploadProps) {
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

      let firstName = obj.firstName?.trim() || '';
      let lastName = obj.lastName?.trim() || '';
      let name = obj.name?.trim() || '';

      // Parse Club Locker "Last, First" column only if we don't already have first/last
      if (obj.lastFirst && (!firstName || !lastName)) {
        const comma = obj.lastFirst.indexOf(',');
        if (comma !== -1) {
          lastName = lastName || obj.lastFirst.slice(0, comma).trim();
          firstName = firstName || obj.lastFirst.slice(comma + 1).trim();
        }
      }

      // Split full name into first/last if we have a name but no split yet
      if (name && !firstName && !lastName) {
        const idx = name.indexOf(' ');
        if (idx !== -1) {
          firstName = name.slice(0, idx);
          lastName = name.slice(idx + 1).trim();
        } else {
          firstName = name;
        }
      }

      // Derive full name from parts if only parts were provided
      if (!name && (firstName || lastName)) {
        name = [firstName, lastName].filter(Boolean).join(' ');
      }

      if (!name) return null;

      return {
        name,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        draw: obj.draw || undefined,
        seed: obj.seed ? parseInt(obj.seed) || undefined : undefined,
        club: obj.club || undefined,
        email: obj.email || undefined,
        phone: obj.phone || undefined,
        club_locker_id: obj.clubLockerId || undefined,
        gender: obj.gender || undefined,
        city: obj.city || undefined,
        rating: obj.rating ? parseFloat(obj.rating) || undefined : undefined,
        ranking: obj.ranking ? parseInt(obj.ranking) || undefined : undefined,
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
  const dupFlags = detectDuplicates(allPlayers, existingPlayers);
  // Only count flags not already excluded
  const activeDupFlags = new Map([...dupFlags.entries()].filter(([i]) => !excludedIndices.has(i)));
  const exactDups = [...activeDupFlags.values()].filter((f) => f.type === 'exact').length;
  const emailDups = [...activeDupFlags.values()].filter((f) => f.type === 'email').length;
  const similarDups = [...activeDupFlags.values()].filter((f) => f.type === 'similar').length;
  const existingDups = [...activeDupFlags.values()].filter((f) => f.type === 'existing').length;
  const fieldOptions: { value: FieldKey; label: string }[] = [
    { value: 'skip', label: '— Skip —' },
    { value: 'name', label: 'Full Name' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'lastFirst', label: 'Last, First (auto-split)' },
    { value: 'draw', label: 'Draw / Event' },
    { value: 'seed', label: 'Seed' },
    { value: 'club', label: 'Club' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'clubLockerId', label: 'Club Locker ID' },
    { value: 'gender', label: 'Gender' },
    { value: 'city', label: 'City' },
    { value: 'rating', label: 'Rating' },
    { value: 'ranking', label: 'Ranking' },
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
            {similarDups > 0 && (
              <p>⚠ <strong>{similarDups}</strong> similar name{similarDups !== 1 ? 's' : ''} (possible duplicate) — highlighted in yellow below</p>
            )}
            {existingDups > 0 && (
              <p>★ <strong>{existingDups}</strong> already in this tournament — highlighted in purple below</p>
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
                const rowBg = flag?.type === 'existing'
                  ? 'bg-purple-50'
                  : flag?.type === 'exact'
                  ? 'bg-red-50'
                  : flag?.type === 'email'
                  ? 'bg-amber-50'
                  : flag?.type === 'similar'
                  ? 'bg-yellow-50'
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
                      {flag?.type === 'similar' && (
                        <span title={`Similar name to row ${flag.otherIdx + 1} (${allPlayers[flag.otherIdx]?.name})`} className="text-yellow-600 cursor-help">~</span>
                      )}
                      {flag?.type === 'existing' && (
                        <span title={`Already in tournament as "${flag.existingName}"`} className="text-purple-600 cursor-help">★</span>
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
