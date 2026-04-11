import Link from 'next/link';
import Image from 'next/image';
import PushManager from '@/components/PushManager';
import AuthButton from './AuthButton';

export default function SiteNav() {
  return (
    <nav className="bg-[#1a2332] text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Seattle Squash" width={40} height={40} className="rounded-full" />
          <span className="font-bold text-lg tracking-tight">Seattle Squash</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/events" className="hover:text-blue-300 transition-colors">Events</Link>
            <Link href="/winter-league" className="hover:text-blue-300 transition-colors">Winter League</Link>
            <Link href="/galleries" className="hover:text-blue-300 transition-colors">Galleries</Link>
            <Link href="/about" className="hover:text-blue-300 transition-colors">About</Link>
            <Link href="/contact" className="hover:text-blue-300 transition-colors">Contact</Link>
          </div>
          <PushManager />
          <AuthButton />
        </div>
      </div>
    </nav>
  );
}
