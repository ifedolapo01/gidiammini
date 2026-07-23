// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const adminToken = request.cookies.get('admin-token')?.value;
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');
  const isLoginPage = request.nextUrl.pathname === '/admin/login';
  // The white-label favicon (app/admin/icon.tsx) must be publicly fetchable —
  // browsers request it unauthenticated, including from the login page itself.
  const isPublicAdminAsset = request.nextUrl.pathname === '/admin/icon';

  // Rule 1: Allow access to login page and public admin assets for everyone
  if (isLoginPage || isPublicAdminAsset) {
    return NextResponse.next();
  }
  
  // Rule 2: Block access to admin routes without valid token
  if (isAdminPath) {
    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    
    const secret = process.env.JWT_SECRET;

    // No fallback secret: a guessable default would let anyone forge a valid
    // admin token. Missing config must fail closed, same as an invalid token.
    if (!secret) {
      console.error('JWT_SECRET environment variable is not defined');
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('admin-token');
      return response;
    }

    const payload = await verifyJWT(adminToken, secret);

    if (!payload || payload.role !== 'admin') {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('admin-token');
      return response;
    }
  }
  
  // Rule 3: Allow access to admin routes with valid token
  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};