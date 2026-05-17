import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminCredentials, generateAdminToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const isValid = verifyAdminCredentials(email, password);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = generateAdminToken(email);

    const response = NextResponse.json({ success: true, message: 'Login successful' });
    
    // Set httpOnly cookie (24h expiry)
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
