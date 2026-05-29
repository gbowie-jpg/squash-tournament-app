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

  // Fault-tolerant GET — returns null on any failure instead of throwing,
  // so one bad endpoint never aborts the whole scrape.
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

  // Try several endpoint shapes, return first that yields data.
  const getFirst = async (paths) => {
    for (const p of paths) {
      const r = await get(p);
      if (r && (Array.isArray(r) ? r.length : Object.keys(r).length)) return r;
    }
    return null;
  };

  console.log(`Scraping tournament ${TOURNAMENT_ID}…`);

  // Tournament basics (non-fatal)
  const tourn = await get(`/tournaments/${TOURNAMENT_ID}`);
  const tournamentName = tourn?.TournamentName || tourn?.name || `Tournament ${TOURNAMENT_ID}`;
  console.log(`✓ ${tournamentName}`);

  // Divisions — required
  const divisions = await getFirst([
    `/tournaments/${TOURNAMENT_ID}/divisions`,
    `/res/tournaments/${TOURNAMENT_ID}/divisions`,
    `/tournaments/${TOURNAMENT_ID}/divisions/all`,
  ]);
  if (!divisions || !Array.isArray(divisions)) {
    alert('Could not fetch divisions. Token may have expired — refresh the tab and retry.');
    return;
  }
  console.log(`✓ ${divisions.length} divisions found`);

  // Entrants — optional (importer does not require them)
  const entrants = (await getFirst([
    `/tournaments/${TOURNAMENT_ID}/entries`,
    `/res/tournaments/${TOURNAMENT_ID}/entries`,
    `/tournaments/${TOURNAMENT_ID}/entrants`,
    `/res/tournaments/${TOURNAMENT_ID}/entrants`,
  ])) || [];
  console.log(`✓ ${entrants.length} entrants${entrants.length === 0 ? ' (skipped/unavailable — not required)' : ''}`);

  // Draws per division
  const divisionsData = {};
  let totalMatches = 0;
  for (const d of divisions) {
    const divId = d.DivisionID || d.divisionId || d.id;
    const divName = d.DivisionName || d.name || `Division ${divId}`;

    let raw = await getFirst([
      `/res/tournaments/${TOURNAMENT_ID}/divisions/${divId}/draws`,
      `/tournaments/${TOURNAMENT_ID}/divisions/${divId}/draws`,
      `/res/draws/${divId}`,
      `/draws/${divId}`,
      `/tournaments/${TOURNAMENT_ID}/divisions/${divId}/matches`,
    ]);
    if (!Array.isArray(raw)) raw = raw ? [raw] : [];

    divisionsData[String(divId)] = { name: divName, data: raw };

    const matchCount = raw.reduce((sum, s) => sum + (s.matches?.length || 0), 0);
    totalMatches += matchCount;
    console.log(`  · ${divName}: ${matchCount} matches`);
  }

  if (totalMatches === 0) {
    alert('Found divisions but no matches in any of them. The draws endpoint may have changed — open a single draw in Club Locker, check the Network tab for the XHR that loads it, and send me the URL.');
    console.error('No matches scraped. Check the Network tab for the real draws endpoint.');
    return;
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

  console.log(`\n✅ Downloaded ${OUTPUT_FILENAME} — ${totalMatches} matches across ${divisions.length} divisions`);
  console.log(`Move it to ~/Downloads/ and run the importer.`);
})();
