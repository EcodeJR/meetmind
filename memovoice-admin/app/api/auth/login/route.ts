import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCredentials, generateAdminToken, isAdminAuthConfigured } from '@/lib/auth';

export async function POST(req: NextRequest) {
  let credentials: { email?: unknown; password?: unknown };
  try {
    credentials = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const { email, password } = credentials;

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  if (!isAdminAuthConfigured()) {
    return NextResponse.json({ error: 'Admin authentication is unavailable' }, { status: 503 });
  }

  if (!verifyAdminCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  try {
    const token = generateAdminToken(email);

    const response = NextResponse.json({ success: true, message: 'Login successful' });
    
    // Keep the browser session short-lived and inaccessible to client JavaScript.
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 8,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Admin authentication is unavailable' }, { status: 503 });
  }
}
