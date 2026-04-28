import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import SiteNav from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function RegisterSuccessPage({ params }: Props) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-[var(--surface)] flex flex-col">
      <SiteNav />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" strokeWidth={1.5} />
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            You&apos;re registered!
          </h1>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
            Payment confirmed. A confirmation email is on its way with your details and a link to your personal player page.
          </p>
          <Link
            href={`/t/${slug}`}
            className="inline-block bg-foreground text-card px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            View Tournament →
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
