import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextApiRequest } from 'next';
import { NextRequest } from 'next/server';

const getJwtSecret = (): string => {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ADMIN_JWT_SECRET must be set to a value of at least 32 characters');
  }
  return secret;
};

export interface AdminPayload {
  email: string;
  role: 'admin';
  iat?: number;
  exp?: number;
}

export function generateAdminToken(email: string): string {
  return jwt.sign({ email, role: 'admin' }, getJwtSecret(), { expiresIn: '8h' });
}

export function verifyAdminToken(token: string): AdminPayload {
  return jwt.verify(token, getJwtSecret()) as AdminPayload;
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) return false;
  if (process.env.NODE_ENV === 'production' && !adminPassword.startsWith('$2')) return false;
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

