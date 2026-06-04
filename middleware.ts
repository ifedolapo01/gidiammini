// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const adminToken = request.cookies.get('admin-token')?.value;
  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');
  const isLoginPage = request.nextUrl.pathname === '/admin/login';
  
  // Rule 1: Allow access to login page for everyone
  if (isLoginPage) {
    return NextResponse.next();
  }
  
  // Rule 2: Block access to admin routes without valid token
  if (isAdminPath) {
    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    
    const secret = process.env.JWT_SECRET || 'fallback-secret';
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