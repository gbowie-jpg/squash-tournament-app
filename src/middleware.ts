import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session (important for SSR)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public tournament pages that don't need auth
  const isVolunteerSignup = /^\/t\/[^/]+\/volunteer$/.test(pathname);

  // Protect admin routes: /admin/* and /t/*/admin/*
  const isAdminRoute =
    pathname.startsWith('/admin') ||
    /^\/t\/[^/]+\/admin/.test(pathname);

  // Protect tournament pages: /t/[slug]/* (except volunteer signup)
  const isTournamentRoute = /^\/t\/[^/]+/.test(pathname);

  if (!isVolunteerSignup && (isAdminRoute || isTournamentRoute) && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Don't let authenticated users see login page
  if (pathname === '/login' && user) {
    const redirect = request.nextUrl.searchParams.get('redirect');
    return NextResponse.redirect(new URL(redirect || '/admin', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/t/:slug/:path*',
    '/t/:slug',
    '/login',
  ],
};
