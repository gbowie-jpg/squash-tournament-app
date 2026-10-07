'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The /auth/confirm button. A plain native form POST (works before hydration
 * and without JS) that ignores a second submit: the one-time token is consumed
 * by the first POST, so a double tap would otherwise cancel that navigation
 * and land on "link expired".
 *
 * The ref check is synchronous, so a second submit event fired before React
 * re-renders is still cancelled. The button has no `name`, so disabling it
 * doesn't change the submitted form data. Don't render `disabled` on the
 * server: the form has to work before hydration.
 */
export default function ConfirmForm({
  tokenHash,
  type,
  next,
  label,
}: {
  tokenHash: string;
  type: string;
  next: string | null;
  label: string;
}) {
  const submitted = useRef(false);
  const [pending, setPending] = useState(false);

  // Coming back via the bfcache: give the person a working button again
  // (resubmitting just lands on link_expired, which explains itself).
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        submitted.current = false;
        setPending(false);
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return (
    <form
      method="post"
      action="/auth/confirm/verify"
      onSubmit={(e) => {
        if (submitted.current) {
          e.preventDefault();
          return;
        }
        submitted.current = true;
        setPending(true);
      }}
    >
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      {next && <input type="hidden" name="next" value={next} />}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="w-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {pending ? 'Confirming…' : label}
      </button>
    </form>
  );
}
