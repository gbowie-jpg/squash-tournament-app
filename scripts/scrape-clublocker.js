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
    const res = await fetch(`${API}${path}`, { headers });
    if (!res.ok) {
      console.error(`✗ ${path} → ${res.status}`);
      return null;
    }
    return res.json();
  };

  console.log(`Scraping tournament ${TOURNAMENT_ID}…`);

  // Tournament basics
  const tourn = await get(`/tournaments/${TOURNAMENT_ID}`);
  if (!tourn) { alert('Tournament fetch failed — token expired? Refresh and try again.'); return; }
  const tournamentName = tourn.TournamentName || tourn.name || `Tournament ${TOURNAMENT_ID}`;
  console.log(`✓ ${tournamentName}`);

  // Divisions
  const divisions = await get(`/tournaments/${TOURNAMENT_ID}/divisions`);
  if (!divisions || !Array.isArray(divisions)) { alert('Divisions fetch failed'); return; }
  console.log(`✓ ${divisions.length} divisions found`);

  // Entrants (full list)
  const entrants = (await get(`/tournaments/${TOURNAMENT_ID}/entries`)) || [];
  console.log(`✓ ${entrants.length} entrants`);

  // Draws per division
  const divisionsData = {};
  for (const d of divisions) {
    const divId = d.DivisionID || d.divisionId || d.id;
    const divName = d.DivisionName || d.name;
    // The Angular app loads draws via /res/tournaments/{tid}/divisions/{divId}/draws
    // Fallback to /tournaments/{tid}/divisions/{divId}/draws if not.
    let raw =
      (await get(`/res/tournaments/${TOURNAMENT_ID}/divisions/${divId}/draws`)) ||
      (await get(`/tournaments/${TOURNAMENT_ID}/divisions/${divId}/draws`));
    if (!Array.isArray(raw)) raw = raw ? [raw] : [];

    divisionsData[String(divId)] = { name: divName, data: raw };

    const matchCount = raw.reduce((sum, s) => sum + (s.matches?.length || 0), 0);
    console.log(`  · ${divName}: ${matchCount} matches`);
  }

  const out = {
    tournamentId: TOURNAMENT_ID,
    tournamentName,
    exportedAt: new Date().toISOString(),
    divisions: divisionsData,
    entrants,
  };

  // Trigger download
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = OUTPUT_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();

  console.log(`\n✅ Downloaded ${OUTPUT_FILENAME}`);
  console.log(`Move it to ~/Downloads/ and run the importer.`);
})();
