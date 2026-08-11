import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // / → /w/playground
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/w/playground', request.url));
  }

  // /playground → /w/playground
  if (pathname === '/playground') {
    return NextResponse.redirect(new URL('/w/playground', request.url));
  }

  // /w/[slug]/edit → /w/playground
  if (pathname.startsWith('/w/') && pathname.endsWith('/edit')) {
    return NextResponse.redirect(new URL('/w/playground', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/playground', '/w/:path*'],
};
