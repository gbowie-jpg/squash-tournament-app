import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Check if the current request has an authenticated user.
 * Returns the user or a 401 response.
 */
export async function requireAuth(): Promise<
  { user: { id: string; email: string }; error?: never } |
  { user?: never; error: NextResponse }
> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component — safe to ignore
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      ),
    };
  }

  return { user: { id: user.id, email: user.email || '' } };
}
