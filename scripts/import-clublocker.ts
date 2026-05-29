/**
 * Club Locker draw importer
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-clublocker.ts <tournament-slug>
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SUPABASE_URL = 'https://rhrkkwvrehntnqqadehq.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const JSON_PATH    = path.join(os.homedir(), 'Downloads', 'seattle-city-champs-2026-draws.json');

// Divisions are auto-included if they have at least one match.
// Override here if you want to skip specific ones.
const SKIP_DIVISION_IDS = new Set<string>([]);

// ── Helpers ────────────────────────────────────────────────────────────────

/** "Luthra, Rehan " → { first: "Rehan", last: "Luthra", full: "Rehan Luthra" } */
function parseName(raw: string | null | undefined): { first: string; last: string; full: string } | null {
  if (!raw?.trim()) return null;
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { last: parts[0], first: parts[1], full: `${parts[1]} ${parts[0]}` };
  return { last: parts[0], first: '', full: parts[0] };
}

function mapRound(r: string): string {
  const map: Record<string, string> = {
    Qrt: 'Quarterfinal', Sem: 'Semifinal', Fin: 'Final',
    R64: 'R64', R32: 'R32', R16: 'R16',
    QF: 'Quarterfinal', SF: 'Semifinal', F: 'Final',
    '3rd': '3rd Place', Playoff: '3rd Place',
  };
  return map[r] ?? r;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error('Usage: npx tsx scripts/import-clublocker.ts <slug>'); process.exit(1); }
  if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY env var required'); process.exit(1); }
  if (!fs.existsSync(JSON_PATH)) { console.error('File not found:', JSON_PATH); process.exit(1); }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Find tournament
  const { data: tournament } = await supabase.from('tournaments').select('id, name, slug').eq('slug', slug).single();
  if (!tournament) {
    const { data: all } = await supabase.from('tournaments').select('name, slug').order('created_at', { ascending: false }).limit(10);
    console.error('Not found:', slug, '\nAvailable:');
    all?.forEach(t => console.log(` ${t.slug} — ${t.name}`));
    process.exit(1);
  }
  console.log(`\n✓ ${tournament.name} (${tournament.id})\n`);

  // 2. Load draw JSON
  const allDraws: Record<string, { name: string; data: any[] }> =
    JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')).divisions;

  // 3. Clear all existing data for a clean re-import
  console.log('Clearing existing data…');
  await supabase.from('matches').delete().eq('tournament_id', tournament.id);
  await supabase.from('players').delete().eq('tournament_id', tournament.id);
  console.log('✓ Cleared\n');

  let totalPlayers = 0;
  let totalMatches = 0;

  // 4. Process each division that has at least one match
  const divisionIds = Object.keys(allDraws).filter((id) => {
    if (SKIP_DIVISION_IDS.has(id)) return false;
    const div = allDraws[id];
    if (!div?.data?.length) return false;
    return div.data.some((s) => Array.isArray(s.matches) && s.matches.length > 0);
  });
  console.log(`Importing ${divisionIds.length} division(s) with matches: ${divisionIds.map((id) => allDraws[id].name).join(', ')}\n`);

  for (const divId of divisionIds) {
    const div = allDraws[divId];

    console.log(`── ${div.name} ─────────────────────────`);

    // Collect unique named players across ALL sections of this division.
    // NOTE: Club Locker only exposes wid1 for h-players; wid2 is always 0 for v-players.
    // Use full name as the deduplication key.
    type PlayerEntry = { full: string; first: string; last: string; seed: number | null };
    const playersByName = new Map<string, PlayerEntry>();

    for (const section of div.data) {
      for (const m of section.matches as any[]) {
        const slots = [
          { nameRaw: m.hplayer1, seed: m.hPlayer1Seeding },
          { nameRaw: m.vplayer1, seed: m.vPlayer1Seeding },
        ];
        for (const { nameRaw, seed } of slots) {
          const p = parseName(nameRaw);
          if (!p) continue;
          const key = p.full.toLowerCase();
          if (!playersByName.has(key)) {
            playersByName.set(key, { ...p, seed: seed ?? null });
          }
        }
      }
    }

    console.log(`  Players: ${playersByName.size}`);

    // Insert players
    const playerRows = Array.from(playersByName.values()).map(p => ({
      tournament_id: tournament.id,
      name: p.full,
      first_name: p.first || null,
      last_name: p.last || null,
      seed: p.seed,
      draw: div.name,
    }));

    const { data: inserted, error: pErr } = await supabase
      .from('players').insert(playerRows).select('id, name');

    if (pErr) { console.error(`  ✗ Players:`, pErr.message); continue; }

    // name (lowercase) → DB id
    const nameToId = new Map((inserted ?? []).map(p => [p.name.toLowerCase(), p.id]));
    console.log(`  ✓ Players inserted`);
    totalPlayers += playersByName.size;

    // Insert matches section by section
    for (const section of div.data) {
      const drawLabel = `${div.name} — ${section.sectionName}`;

      const matchRows = (section.matches as any[]).map((m, idx) => {
        const p1 = parseName(m.hplayer1);
        const p2 = parseName(m.vplayer1);
        const p1id = p1 ? (nameToId.get(p1.full.toLowerCase()) ?? null) : null;
        const p2id = p2 ? (nameToId.get(p2.full.toLowerCase()) ?? null) : null;

        let scheduledTime: string | null = null;
        if (m.matchdate) {
          const [mo, day, yr] = (m.matchdate as string).split('/');
          scheduledTime = `${yr}-${mo.padStart(2,'0')}-${day.padStart(2,'0')}T09:00:00`;
        }

        const seed1 = m.hPlayer1Seeding ? `[${m.hPlayer1Seeding}]` : null;
        const seed2 = m.vPlayer1Seeding ? `[${m.vPlayer1Seeding}]` : null;
        const notes = (seed1 || seed2) ? `${seed1 ?? 'TBD'} vs ${seed2 ?? 'TBD'}` : null;

        return {
          tournament_id: tournament.id,
          player1_id: p1id,
          player2_id: p2id,
          draw: drawLabel,
          round: mapRound(m.RoundDescr as string ?? ''),
          match_number: m.MatchNumber ?? idx + 1,
          sort_order: ((m.RoundNumber ?? 0) * 1000) + (m.MatchNumber ?? idx),
          status: 'scheduled',
          scheduled_time: scheduledTime,
          notes,
        };
      });

      const { error: mErr } = await supabase.from('matches').insert(matchRows);
      if (mErr) console.error(`  ✗ ${section.sectionName}:`, mErr.message);
      else { console.log(`  ✓ ${section.sectionName}: ${matchRows.length} matches`); totalMatches += matchRows.length; }
    }
    console.log();
  }

  console.log(`✅ Done — ${totalPlayers} players, ${totalMatches} matches`);
  console.log(`   https://app.seattlesquash.com/t/${slug}/admin/draws\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
