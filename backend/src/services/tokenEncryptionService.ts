import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

const key = (): Buffer => {
  const value = process.env.INTEGRATION_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY must be a 64-character hexadecimal key.');
  }
  return Buffer.from(value, 'hex');
};

export const encryptIntegrationToken = (value: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
};

export const decryptIntegrationToken = (value: string): string => {
  const [ivPart, tagPart, dataPart] = value.split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Invalid encrypted integration token.');
  const decipher = crypto.createDecipheriv(ALGORITHM, key(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
};
