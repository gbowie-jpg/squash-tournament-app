/**
 * Import players from a Club Locker entrants CSV export.
 * Only imports players where IsInDraw=true and PlayerDrawStatus=Playing.
 * Clears all existing players and matches first (full replace).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-from-csv.ts <tournament-slug> <path-to-csv>
 *
 * Example:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-from-csv.ts seattle-city-championships ~/Downloads/"tournament entrants dl.csv"
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://rhrkkwvrehntnqqadehq.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => row[h.trim()] = (values[i] ?? '').trim());
    return row;
  });
}

async function main() {
  const slug    = process.argv[2];
  const csvPath = process.argv[3];

  if (!slug || !csvPath) {
    console.error('Usage: npx tsx scripts/import-from-csv.ts <slug> <csv-path>');
    process.exit(1);
  }
  if (!SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY env var required');
    process.exit(1);
  }
  const resolvedPath = csvPath.startsWith('~') ? csvPath.replace('~', process.env.HOME ?? '') : csvPath;
  if (!fs.existsSync(resolvedPath)) {
    console.error('File not found:', resolvedPath);
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Find tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!tournament) {
    const { data: all } = await supabase.from('tournaments').select('name, slug').limit(10);
    console.error('Tournament not found:', slug, '\nAvailable:');
    all?.forEach(t => console.log(' ', t.slug, '—', t.name));
    process.exit(1);
  }
  console.log(`\n✓ ${tournament.name} (${tournament.id})\n`);

  // Parse CSV
  const rows = parseCsv(fs.readFileSync(resolvedPath, 'utf8'));

  // Filter: in draw and actively playing
  const playing = rows.filter(r =>
    r['IsInDraw']?.toLowerCase() === 'true' &&
    r['PlayerDrawStatus'] === 'Playing'
  );

  console.log(`CSV total rows: ${rows.length}`);
  console.log(`Active in draw: ${playing.length}`);
  console.log(`Withdrawn/waitlist: ${rows.filter(r => r['PlayerDrawStatus'] === 'NotPlaying').length}\n`);

  // Group by division
  const byDiv = new Map<string, { name: string; id: string; players: typeof playing }>();
  for (const r of playing) {
    const divName = r['Division'];
    const divId   = r['DivisionId'];
    if (!byDiv.has(divId)) byDiv.set(divId, { name: divName, id: divId, players: [] });
    byDiv.get(divId)!.players.push(r);
  }

  console.log('Divisions to import:');
  for (const [id, div] of byDiv) {
    console.log(`  [${id}] ${div.name}: ${div.players.length} players`);
  }
  console.log();

  // Clear existing data
  console.log('Clearing existing data…');
  await supabase.from('matches').delete().eq('tournament_id', tournament.id);
  await supabase.from('players').delete().eq('tournament_id', tournament.id);
  console.log('✓ Cleared\n');

  let totalPlayers = 0;

  for (const [, div] of byDiv) {
    console.log(`── ${div.name} ─────────────────────────`);

    const playerRows = div.players.map(r => {
      const fullName = r['PlayerName'].trim();
      const lastFirst = r['LastFirst'].trim();
      // Parse "Last, First " → first and last
      const parts = lastFirst.split(',').map(s => s.trim());
      const lastName  = parts[0] || '';
      const firstName = parts[1] || '';
      const seed = r['Seeding'] ? parseInt(r['Seeding']) || null : null;
      const email = r['Email'];
      const validEmail = email && email !== 'No TRN Contact' ? email : null;
      const rating = r['PlayerSeedingRating'] ? parseFloat(r['PlayerSeedingRating']) || null : null;
      const city   = r['PlayerCity'] || null;
      const state  = r['PlayerState'] || null;
      const club_locker_id = r['PlayerId'] || null;

      return {
        tournament_id: tournament.id,
        name: fullName,
        first_name: firstName || null,
        last_name: lastName || null,
        seed,
        draw: div.name,
        email: validEmail,
      };
    });

    const { data: inserted, error } = await supabase
      .from('players')
      .insert(playerRows)
      .select('id, name, email');

    if (error) {
      console.error(`  ✗ Error:`, error.message);
      continue;
    }
    console.log(`  ✓ ${inserted?.length ?? 0} players inserted`);
    totalPlayers += inserted?.length ?? 0;

    // Sync emails to email_recipients
    const withEmail = (inserted ?? []).filter((p: {email?: string | null}) => p.email);
    if (withEmail.length > 0) {
      await supabase.from('email_recipients').upsert(
        withEmail.map((p: {name: string; email: string}) => ({
          tournament_id: tournament.id,
          name: p.name,
          email: p.email.trim().toLowerCase(),
          type: 'player',
        })),
        { onConflict: 'tournament_id,email', ignoreDuplicates: true },
      );
      console.log(`  ✓ ${withEmail.length} email recipients synced`);
    }
    console.log();
  }

  console.log(`✅ Done — ${totalPlayers} players across ${byDiv.size} divisions`);
  console.log(`   Bracket matches cleared — generate fresh draws at:`);
  console.log(`   https://app.seattlesquash.com/t/${slug}/admin/draws\n`);
  console.log('Note: match structure not in CSV — go to admin/draws to generate brackets.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
