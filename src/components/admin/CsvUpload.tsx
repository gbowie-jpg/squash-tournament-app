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
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      setHeaders(h);
      setRows(r);
      setMapping(h.map(guessField));
      setStep('mapping');
    };
    reader.readAsText(file);
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
    const players = buildPlayers();
    if (players.length === 0) return;
    setImporting(true);

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
        if (fileRef.current) fileRef.current.value = '';
      }
    } finally {
      setImporting(false);
    }
  };

  const previewPlayers = step === 'mapping' ? buildPlayers() : [];
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
      <div className="border-2 border-dashed border-zinc-300 rounded-xl p-6 text-center">
        <p className="text-sm text-zinc-500 mb-3">Upload a CSV file to bulk-add players</p>
        <p className="text-xs text-zinc-600 mb-4">Works with ClubLocker exports, or any CSV with player names</p>
        <label className="inline-block bg-zinc-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 cursor-pointer transition-colors">
          Choose CSV File
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFile}
            className="hidden"
          />
        </label>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
      {/* Column mapping */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Map Columns</h3>
          <button onClick={() => { setStep('idle'); if (fileRef.current) fileRef.current.value = ''; }} className="text-xs text-zinc-600 hover:text-zinc-800">
            Cancel
          </button>
        </div>
        <p className="text-xs text-zinc-600 mb-3">
          {rows.length} rows found. Confirm the column mapping below:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {headers.map((h, i) => (
            <div key={i}>
              <p className="text-xs text-zinc-500 mb-1 truncate" title={h}>{h}</p>
              <select
                value={mapping[i]}
                onChange={(e) => {
                  const newMapping = [...mapping];
                  newMapping[i] = e.target.value as FieldKey;
                  setMapping(newMapping);
                }}
                className={`w-full border rounded-lg px-2 py-1.5 text-xs ${
                  mapping[i] === 'skip' ? 'border-zinc-200 text-zinc-600' : 'border-zinc-400 text-zinc-900 font-medium'
                }`}
              >
                {fieldOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {rows[0]?.[i] && (
                <p className="text-xs text-zinc-300 mt-0.5 truncate">e.g. {rows[0][i]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <h3 className="font-semibold mb-2">Preview ({previewPlayers.length} players)</h3>
        <div className="max-h-60 overflow-auto border border-zinc-100 rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="text-left px-3 py-2 font-medium text-zinc-500">Name</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-500">Draw</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-500">Seed</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-500">Club</th>
                <th className="text-left px-3 py-2 font-medium text-zinc-500">Email</th>
              </tr>
            </thead>
            <tbody>
              {previewPlayers.slice(0, 20).map((p, i) => (
                <tr key={i} className="border-b border-zinc-50">
                  <td className="px-3 py-1.5 font-medium">{p.name}</td>
                  <td className="px-3 py-1.5 text-zinc-500">{p.draw || '—'}</td>
                  <td className="px-3 py-1.5 text-zinc-500">{p.seed || '—'}</td>
                  <td className="px-3 py-1.5 text-zinc-500">{p.club || '—'}</td>
                  <td className="px-3 py-1.5 text-zinc-500">{p.email || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {previewPlayers.length > 20 && (
            <p className="text-xs text-zinc-600 text-center py-2">...and {previewPlayers.length - 20} more</p>
          )}
        </div>
      </div>

      {/* Import button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleImport}
          disabled={importing || previewPlayers.length === 0}
          className="bg-zinc-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? 'Importing...' : `Import ${previewPlayers.length} Players`}
        </button>
        {previewPlayers.length === 0 && (
          <p className="text-xs text-red-500">No valid players found. Make sure a Name column is mapped.</p>
        )}
      </div>
    </div>
  );
}
