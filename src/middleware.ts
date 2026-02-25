import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Admin routes
    if (path.startsWith('/admin') || path.startsWith('/gm')) {
        const adminCookie = request.cookies.get('admin_auth')?.value;
        if (adminCookie !== 'true') {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    // Player routes
    if (path.startsWith('/player/')) {
        const idInPath = path.split('/player/')[1];
        const brigadeCookie = request.cookies.get('brigade_auth')?.value;

        if (!brigadeCookie || brigadeCookie !== idInPath) {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    // Staff routes
    if (path.startsWith('/staff/')) {
        const idInPath = path.split('/staff/')[1];
        const staffCookie = request.cookies.get('staff_auth')?.value;

        if (!staffCookie || staffCookie !== idInPath) {
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/gm/:path*', '/player/:path*', '/staff/:path*'],
};
