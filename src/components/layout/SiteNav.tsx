import Link from 'next/link';
import Image from 'next/image';
import PushManager from '@/components/PushManager';
import AuthButton from './AuthButton';
import ThemeToggle from '@/components/ThemeToggle';

export default function SiteNav() {
  return (
    <nav className="bg-[var(--nav-bg)] text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Seattle Squash" width={40} height={40} className="rounded-full" />
          <span className="font-bold text-lg tracking-tight">Seattle Squash</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-6 text-sm mr-2">
            <Link href="/events" className="text-white/70 hover:text-white transition-colors">Events</Link>
            <Link href="/winter-league" className="text-white/70 hover:text-white transition-colors">Winter League</Link>
            <Link href="/galleries" className="text-white/70 hover:text-white transition-colors">Galleries</Link>
            <Link href="/about" className="text-white/70 hover:text-white transition-colors">About</Link>
            <Link href="/contact" className="text-white/70 hover:text-white transition-colors">Contact</Link>
          </div>
          <PushManager />
          <ThemeToggle />
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
