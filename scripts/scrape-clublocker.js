/**
 * Club Locker tournament scraper — run in browser DevTools console.
 *
 * USAGE:
 * 1. Log into clublocker.com in Chrome (so your auth token is in localStorage)
 * 2. Open the tournament page, e.g. https://clublocker.com/tournaments/19191
 * 3. Open DevTools → Console
 * 4. Paste this entire file's contents, hit Enter
 * 5. A "seattle-city-champs-2026-draws.json" file will download
 * 6. Move it to ~/Downloads/ (overwriting the old one)
 * 7. Run the importer: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/import-clublocker.ts seattle-city-championships
 *
 * If you get an auth error: refresh the Club Locker tab and try again
 * (the token may have expired — there's no programmatic refresh).
 *
 * The draws endpoint (/tournaments/{id}/draws?) returns a FLAT array of
 * sections, each tagged with divisionId/divisionName. We group them back
 * into { [divisionId]: { name, data: [sections] } } for the importer.
 */

(async () => {
  const TOURNAMENT_ID = 19191; // Seattle City Championships
  const OUTPUT_FILENAME = 'seattle-city-champs-2026-draws.json';
  const API = 'https://api.ussquash.com/resources';

  const token = localStorage.getItem('token_usq-clublocker');
  if (!token) {
    alert('Not logged into Club Locker. Log in first, then retry.');
    return;
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  const get = async (path) => {
    try {
      const res = await fetch(`${API}${path}`, { headers });
      if (!res.ok) { console.warn(`  ✗ ${path} → ${res.status}`); return null; }
      return await res.json();
    } catch (e) {
      console.warn(`  ✗ ${path} → ${e.message}`);
      return null;
    }
  };

  console.log(`Scraping tournament ${TOURNAMENT_ID}…`);

  // Tournament basics (non-fatal)
  const tourn = await get(`/tournaments/${TOURNAMENT_ID}`);
  const tournamentName = tourn?.TournamentName || tourn?.name || `Tournament ${TOURNAMENT_ID}`;
  console.log(`✓ ${tournamentName}`);

  // ALL draws in one shot — flat array of sections
  const sections = await get(`/tournaments/${TOURNAMENT_ID}/draws?`);
  if (!Array.isArray(sections)) {
    alert('Could not fetch draws. Token may have expired — refresh the tab and retry.');
    return;
  }

  // Group sections by divisionId → { name, data: [sections] }
  const divisionsData = {};
  let totalMatches = 0;
  for (const s of sections) {
    const divId = String(s.divisionId);
    if (!divisionsData[divId]) {
      divisionsData[divId] = { name: s.divisionName?.trim() || `Division ${divId}`, data: [] };
    }
    divisionsData[divId].data.push(s);
    totalMatches += s.matches?.length || 0;
  }

  const divCount = Object.keys(divisionsData).length;
  console.log(`✓ ${sections.length} sections across ${divCount} divisions, ${totalMatches} matches`);
  for (const [id, d] of Object.entries(divisionsData)) {
    const mc = d.data.reduce((sum, s) => sum + (s.matches?.length || 0), 0);
    if (mc > 0) console.log(`  · ${d.name}: ${mc} matches`);
  }

  if (totalMatches === 0) {
    alert('Draws endpoint returned no matches. The brackets may not be published yet.');
    return;
  }

  const out = {
    tournamentId: TOURNAMENT_ID,
    tournamentName,
    exportedAt: new Date().toISOString(),
    divisions: divisionsData,
    entrants: [], // not needed by importer
  };

  // Trigger download
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = OUTPUT_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();

  console.log(`\n✅ Downloaded ${OUTPUT_FILENAME} — ${totalMatches} matches across ${divCount} divisions`);
  console.log(`Move it to ~/Downloads/ and run the importer.`);
})();
