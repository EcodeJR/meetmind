import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextApiRequest } from 'next';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';

export interface AdminPayload {
  email: string;
  role: 'admin';
  iat?: number;
  exp?: number;
}

export function generateAdminToken(email: string): string {
  return jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyAdminToken(token: string): AdminPayload {
  return jwt.verify(token, JWT_SECRET) as AdminPayload;
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) return false;
  if (email !== adminEmail) return false;

  // Support both hashed and plain passwords for development
  try {
    if (adminPassword.startsWith('$2b$') || adminPassword.startsWith('$2a$')) {
      return bcrypt.compareSync(password, adminPassword);
    }
    return password === adminPassword;
  } catch {
    return false;
  }
}

export function getAdminTokenFromRequest(req: NextApiRequest | NextRequest): string | null {
  if ('cookies' in req && typeof req.cookies.get === 'function') {
    return req.cookies.get('admin_token')?.value || null;
  }
  
  const cookieHeader = (req.headers as any).cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c: string) => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  return cookies['admin_token'] || null;
}

export function requireAdminAuth(req: NextApiRequest | NextRequest): AdminPayload {
  const token = getAdminTokenFromRequest(req);
  if (!token) throw new Error('No token provided');
  return verifyAdminToken(token);
}

