import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

export default function LeagueShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <SiteNav />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
