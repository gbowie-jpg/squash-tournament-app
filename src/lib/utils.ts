export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function formatScore(scores: { p1: number; p2: number }[]): string {
  if (!scores || scores.length === 0) return '';
  return scores.map((g) => `${g.p1}-${g.p2}`).join(', ');
}

export function getMatchWinner(scores: { p1: number; p2: number }[]): 'p1' | 'p2' | null {
  if (!scores || scores.length === 0) return null;
  let p1Games = 0;
  let p2Games = 0;
  for (const game of scores) {
    if (game.p1 > game.p2) p1Games++;
    else if (game.p2 > game.p1) p2Games++;
  }
  if (p1Games > p2Games) return 'p1';
  if (p2Games > p1Games) return 'p2';
  return null;
}
