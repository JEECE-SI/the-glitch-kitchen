import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { role, id } = await request.json();
    const response = NextResponse.json({ success: true });

    if (role === 'admin') {
        response.cookies.set('admin_auth', 'true', { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 });
    } else if (role === 'player') {
        response.cookies.set('brigade_auth', id, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
    } else if (role === 'staff') {
        response.cookies.set('staff_auth', id, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 });
    }

    return response;
}
