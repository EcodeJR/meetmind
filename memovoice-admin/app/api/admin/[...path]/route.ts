import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';

const forwardAdminRequest = async (
  request: NextRequest,
  context: { params: { path: string[] } }
): Promise<NextResponse> => {
  try {
    const admin = requireAdminAuth(request);

    const apiBaseUrl = process.env.RAILWAY_API_URL;
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    if (!apiBaseUrl || !adminSecret) {
      return NextResponse.json({ error: 'Admin API is not configured' }, { status: 503 });
    }

    const { path } = context.params;
    const upstreamUrl = new URL(`/admin/${path.map(encodeURIComponent).join('/')}`, apiBaseUrl);
    upstreamUrl.search = request.nextUrl.search;

    const headers = new Headers();
    headers.set('x-admin-key', adminSecret);
    headers.set('x-admin-actor', admin.email);
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
      cache: 'no-store',
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
};

export const GET = forwardAdminRequest;
export const POST = forwardAdminRequest;
export const PATCH = forwardAdminRequest;
export const DELETE = forwardAdminRequest;
