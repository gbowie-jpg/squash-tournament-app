import Link from 'next/link';
import type { Tournament } from '@/lib/supabase/types';

/** Card for a tournament run on this app (live draws, scores, court board). */
export default function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  const dateStr = new Date(t.start_date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const endDateStr = t.end_date
    ? new Date(t.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400',
    upcoming: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
    completed: 'bg-surface text-muted-foreground',
  };

  return (
    <Link
      href={`/t/${t.slug}`}
      className="flex items-center gap-4 bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group"
    >
      {/* Tournament image / placeholder */}
      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-[#1a2332] flex items-center justify-center border border-border">
        {t.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">🏆</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight text-[var(--text-primary)]">{t.name}</h3>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${statusColors[t.status] || statusColors.upcoming}`}>
            {t.status === 'active' ? 'Live' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
          </span>
        </div>
        {t.venue && <p className="text-[var(--text-secondary)] text-sm mt-1 truncate">{t.venue}</p>}
        <p className="text-[var(--text-muted)] text-sm mt-0.5">
          {dateStr}{endDateStr ? ` – ${endDateStr}` : ''}
        </p>
      </div>
    </Link>
  );
}
