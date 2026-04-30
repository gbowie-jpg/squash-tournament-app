import Link from 'next/link';
import Image from 'next/image';
import PushManager from '@/components/PushManager';
import AuthButton from './AuthButton';
import ThemeToggle from '@/components/ThemeToggle';

export default function SiteNav() {
  // In gated/single-tournament mode, hide site-wide nav links so visitors
  // only see the featured tournament — not the unfinished rest of the site.
  const gated = !!process.env.NEXT_PUBLIC_FEATURED_SLUG;

  return (
    <nav className="bg-[var(--nav-bg)] text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Seattle Squash" width={40} height={40} className="rounded-full" />
          <span className="font-bold text-lg tracking-tight">Seattle Squash</span>
        </Link>
        <div className="flex items-center gap-2">
          {!gated && (
            <div className="hidden md:flex items-center gap-6 text-sm mr-2">
              <Link href="/events" className="text-white/70 hover:text-white transition-colors">Events</Link>
              <Link href="/winter-league" className="text-white/70 hover:text-white transition-colors">Winter League</Link>
              <Link href="/galleries" className="text-white/70 hover:text-white transition-colors">Galleries</Link>
              <Link href="/scholarship" className="text-white/70 hover:text-white transition-colors">Scholarship</Link>
              <Link href="/about" className="text-white/70 hover:text-white transition-colors">About</Link>
              <Link href="/contact" className="text-white/70 hover:text-white transition-colors">Contact</Link>
            </div>
          )}
          <PushManager />
          <ThemeToggle />
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
