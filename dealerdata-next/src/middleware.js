import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public or API webhook paths that handle their own token/secret verification
  const isPublicPath =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/specials/') ||
    pathname.startsWith('/_next') ||
    pathname.includes('favicon.ico');

  const sessionToken = request.cookies.get('dealerdata_session')?.value;
  const hasApiAuthHeader = Boolean(request.headers.get('authorization') || request.headers.get('x-api-key'));

  // If user is already authenticated and visits login or signup, redirect to dashboard
  if (sessionToken && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If user is not authenticated and attempts to access protected routes
  if (!sessionToken && !hasApiAuthHeader && !isPublicPath) {
    // If it's an API call, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    // For page requests, redirect to /login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
