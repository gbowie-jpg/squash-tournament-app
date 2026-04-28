import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function UnsubscribePage({ searchParams }: Props) {
  const { status } = await searchParams;

  const content = {
    ok: {
      icon: <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" strokeWidth={1.5} />,
      heading: "You've been unsubscribed",
      body: "You won't receive any more emails from Seattle Squash. If this was a mistake, contact us and we'll re-add you.",
    },
    notfound: {
      icon: <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" strokeWidth={1.5} />,
      heading: 'Link not found',
      body: "We couldn't find that unsubscribe link. It may have already been used or the link is invalid.",
    },
    invalid: {
      icon: <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" strokeWidth={1.5} />,
      heading: 'Invalid link',
      body: 'This unsubscribe link is malformed. Please use the link directly from your email.',
    },
  }[status ?? 'invalid'] ?? {
    icon: <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" strokeWidth={1.5} />,
    heading: 'Something went wrong',
    body: 'Please try again or contact us directly.',
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl p-8 text-center">
        {content.icon}
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-3">{content.heading}</h1>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{content.body}</p>
        <Link
          href="/"
          className="inline-block mt-6 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          ← Back to Seattle Squash
        </Link>
      </div>
    </div>
  );
}
