import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Define paths that require authentication
  const isDashboardPath = pathname.startsWith('/dashboard');
  const isLoginPath = pathname === '/login';

  // Check for the admin_token cookie
  const token = request.cookies.get('admin_token')?.value;

  let isAuthenticated = false;

  if (token) {
    try {
      // Use jose for edge-compatible token verification
      const secret = new TextEncoder().encode(JWT_SECRET);
      await jose.jwtVerify(token, secret);
      isAuthenticated = true;
    } catch (err) {
      console.warn('Invalid JWT token in middleware:', err);
      // Token is invalid or expired
      isAuthenticated = false;
    }
  }

  // Case 1: Trying to access dashboard without authentication
  if (isDashboardPath && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Keep track of the original page to redirect back after login
    loginUrl.searchParams.set('from', pathname);
    
    // Redirect to login page and clear the invalid cookie if present
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      response.cookies.delete('admin_token');
    }
    return response;
  }

  // Case 2: Trying to access login page while already authenticated
  if (isLoginPath && isAuthenticated) {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Allow all other requests to proceed
  return NextResponse.next();
}

// Configure paths that will trigger this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
