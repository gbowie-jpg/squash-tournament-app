import Link from 'next/link';
import { redirect } from 'next/navigation';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Tournament } from '@/lib/supabase/types';
import { heroBackground, getTextColors } from '@/lib/gradients';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const featuredSlug = process.env.NEXT_PUBLIC_FEATURED_SLUG;
  if (featuredSlug) {
    redirect(`/t/${featuredSlug}/register`);
  }

  const supabase = await createServerSupabaseClient();

  const [{ data: tournaments }, { data: settingsRows }] = await Promise.all([
    supabase.from('tournaments').select('*').order('start_date', { ascending: false }),
    supabase.from('site_settings').select('key, value'),
  ]);

  const allTournaments = (tournaments ?? []) as Tournament[];
  const upcoming = allTournaments.filter((t) => t.status === 'upcoming' || t.status === 'active');
  const past = allTournaments.filter((t) => t.status === 'completed');

  // Flatten settings into a key→value map
  const s: Record<string, string | null> = {};
  for (const row of (settingsRows ?? []) as { key: string; value: string | null }[]) {
    s[row.key] = row.value;
  }

  const heroImage = s.homepage_hero_image;
  const heroGradient = s.homepage_hero_gradient;
  const heroOverlay = s.homepage_hero_overlay !== 'false';
  const textColors = getTextColors(s.homepage_hero_text_color);
  const heroTitle = s.homepage_hero_title || 'Unleash your inner athlete and play the ultimate game.';
  const heroSubtitle = s.homepage_hero_subtitle || 'Your home for competitive squash in the Pacific Northwest. Over 70 years of fostering the squash community in Seattle.';
  const cta1Label = s.homepage_cta1_label || 'View Tournaments';
  const cta1Href = s.homepage_cta1_href || '#tournaments';
  const cta2Label = s.homepage_cta2_label || 'Donate';
  const cta2Href = s.homepage_cta2_href || '/donate';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <SiteNav />

      {/* Hero */}
      <section
        className="relative text-white"
        style={{ background: heroBackground(heroImage, heroGradient, heroOverlay) }}
      >
        <div className="max-w-6xl mx-auto px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <p className="font-medium text-sm uppercase tracking-wider mb-3" style={{ color: textColors.accent }}>
              Seattle Squash Racquets Association
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight" style={{ color: textColors.heading }}>
              {heroTitle}
            </h1>
            <p className="text-lg mt-4 leading-relaxed" style={{ color: textColors.body }}>
              {heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href={cta1Href}
                className="bg-white text-[#1a2332] px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                {cta1Label}
              </Link>
              <Link
                href={cta2Href}
                className="border border-white/30 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                {cta2Label}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section className="bg-[var(--surface-card)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-10 text-[var(--text-secondary)]">What We Do</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard emoji="📣" color="blue" title="Communication"
              desc="Keeping the community informed on local squash activity, events, and league updates across the Pacific Northwest." />
            <FeatureCard emoji="🏆" color="green" title="Tournaments & League"
              desc="Tuesday night league matches from November to March, plus the Washington State Open and Seattle City Championships." />
            <FeatureCard emoji="🤝" color="amber" title="Support"
              desc="Funding Howe Cup teams, coaching programs, junior development, and growing squash participation across all levels." />
          </div>
        </div>
      </section>

      {/* Tournaments */}
      <section id="tournaments" className="scroll-mt-4 flex-1">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold mb-2 text-[var(--text-primary)]">Tournaments</h2>
          <p className="text-[var(--text-secondary)] mb-8">Live draws, real-time scores, and match schedules.</p>

          {allTournaments.length === 0 && (
            <div className="text-center py-12 bg-[var(--surface-card)] rounded-xl border border-[var(--border)]">
              <p className="text-[var(--text-secondary)] text-lg">No tournaments yet.</p>
              <p className="text-[var(--text-muted)] text-sm mt-2">Check back soon or contact the organizer.</p>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
                {upcoming.some((t) => t.status === 'active') ? 'Active & Upcoming' : 'Upcoming'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcoming.map((t) => <TournamentCard key={t.id} tournament={t} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Past</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {past.map((t) => <TournamentCard key={t.id} tournament={t} />)}
              </div>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function FeatureCard({ emoji, color, title, desc }: { emoji: string; color: string; title: string; desc: string }) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-950/40',
    green: 'bg-green-100 dark:bg-green-950/40',
    amber: 'bg-amber-100 dark:bg-amber-950/40',
  };
  return (
    <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-6 text-center">
      <div className={`w-14 h-14 ${bg[color]} rounded-full flex items-center justify-center mx-auto mb-4`}>
        <span className="text-2xl">{emoji}</span>
      </div>
      <h3 className="font-semibold text-lg mb-2 text-[var(--text-primary)]">{title}</h3>
      <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function TournamentCard({ tournament: t }: { tournament: Tournament }) {
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
