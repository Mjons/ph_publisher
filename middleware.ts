import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const session = request.cookies.get('ph_admin_session');
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!session?.value || !secret) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const valid = await verifyToken(session.value, secret);

  if (!valid) {
    const loginUrl = new URL('/admin/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set('ph_admin_session', '', { path: '/', maxAge: 0 });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
