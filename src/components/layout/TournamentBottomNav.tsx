'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Search, Megaphone, User } from 'lucide-react';

type Props = { slug: string };

const TABS = [
  { href: (slug: string) => `/t/${slug}`, exact: true, Icon: Home, label: 'Home' },
  { href: (slug: string) => `/t/${slug}/courts`, exact: false, Icon: ClipboardList, label: 'Courts' },
  { href: (slug: string) => `/t/${slug}/players`, exact: false, Icon: Search, label: 'Players' },
  { href: (slug: string) => `/t/${slug}/announcements`, exact: false, Icon: Megaphone, label: 'News' },
  { href: (_slug: string) => `/account`, exact: false, Icon: User, label: 'Me' },
];

export default function TournamentBottomNav({ slug }: Props) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[var(--surface-card)] border-t border-[var(--border)] z-40 pb-safe">
      <div className="grid grid-cols-5 h-16">
        {TABS.map((tab) => {
          const href = tab.href(slug);
          const isActive = tab.exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
            >
              <tab.Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
