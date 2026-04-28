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

  // Admin routes always require auth: /admin/* and /t/[slug]/admin/*
  const isAdminRoute =
    pathname.startsWith('/admin') ||
    /^\/t\/[^/]+\/admin(\/|$)/.test(pathname);

  // All /t/[slug]/* pages are public except admin sub-routes.
  // Registered players can view draws, schedule, players, courts etc. without an account.
  const isTournamentRoute = /^\/t\/[^/]+/.test(pathname);
  const isPublicTournamentRoute = isTournamentRoute && !isAdminRoute;

  if (!isPublicTournamentRoute && (isAdminRoute || isTournamentRoute) && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Don't let authenticated users see login page
  if (pathname === '/login' && user) {
    const redirect = request.nextUrl.searchParams.get('redirect');
    // Only allow relative paths — reject anything with a protocol or double-slash
    // to prevent open redirect phishing (e.g. /login?redirect=https://evil.com)
    const isSafeRedirect =
      redirect &&
      redirect.startsWith('/') &&
      !redirect.startsWith('//') &&
      !redirect.includes(':');
    return NextResponse.redirect(new URL(isSafeRedirect ? redirect : '/admin', request.url));
  }

  // Security headers
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HSTS — tell browsers to always use HTTPS for the next year
  supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // CSP — restrict resource loading to same origin + known external sources
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Scripts: self + Next.js inline scripts (needed for hydration)
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Styles: self + inline (Tailwind injects inline styles)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + Supabase storage + data URIs
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      // Fonts: self
      "font-src 'self'",
      // API/WS connections: self + Supabase
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com",
      // Media (videos): self + Supabase storage
      "media-src 'self' https://*.supabase.co",
      // No frames allowed
      "frame-ancestors 'none'",
      // Form submissions only to self
      "form-action 'self'",
    ].join('; '),
  );

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/t/:slug/:path*',
    '/t/:slug',
    '/login',
    '/unsubscribe',
    '/api/:path*',
  ],
};
