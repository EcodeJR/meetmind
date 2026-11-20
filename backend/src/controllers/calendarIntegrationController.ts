import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { URL, URLSearchParams } from 'url';
import { AuthRequest } from '../middleware/auth';
import { CalendarIntegration, CalendarProvider } from '../models/CalendarIntegration';
import { User } from '../models/User';
import { decryptIntegrationToken, encryptIntegrationToken } from '../services/tokenEncryptionService';
import { sendError, sendSuccess } from '../utils/responses';
import { logger } from '../utils/logger';

type OAuthConfiguration = { clientId: string; clientSecret: string; redirectUri: string; authorizeUrl: string; tokenUrl: string; scopes: string[] };
type StatePayload = { clerkId: string; provider: CalendarProvider };

const stateSecret = (): string | null => process.env.INTEGRATIONS_STATE_SECRET || process.env.JWT_SECRET || null;
const mobileRedirectUri = (): string => process.env.MOBILE_OAUTH_REDIRECT_URI || 'memovoice://settings/integrations';
const providerConfiguration = (provider: CalendarProvider): OAuthConfiguration | null => {
  const google = provider === 'google';
  const clientId = google ? process.env.GOOGLE_CALENDAR_CLIENT_ID : process.env.MICROSOFT_CALENDAR_CLIENT_ID;
  const clientSecret = google ? process.env.GOOGLE_CALENDAR_CLIENT_SECRET : process.env.MICROSOFT_CALENDAR_CLIENT_SECRET;
  const redirectUri = google ? process.env.GOOGLE_CALENDAR_REDIRECT_URI : process.env.MICROSOFT_CALENDAR_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri || !stateSecret() || !process.env.INTEGRATION_ENCRYPTION_KEY) return null;
  return google
    ? { clientId, clientSecret, redirectUri, authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth', tokenUrl: 'https://oauth2.googleapis.com/token', scopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'] }
    : { clientId, clientSecret, redirectUri, authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', scopes: ['openid', 'email', 'offline_access', 'Calendars.ReadWrite'] };
};

const providerFromParam = (value: string): CalendarProvider | null => value === 'google' || value === 'outlook' ? value : null;
const appendMobileResult = (params: Record<string, string>): string => {
  const url = new URL(mobileRedirectUri());
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
};

export const listCalendarIntegrations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ clerkId: req.clerkId });
    if (!user) { sendError(res, 'USER_NOT_FOUND', 'User not found.', 404); return; }
    const integrations = await CalendarIntegration.find({ userId: user._id }).select('provider providerEmail scope updatedAt').lean();
    const byProvider = new Map(integrations.map(integration => [integration.provider, integration]));
    sendSuccess(res, {
      integrations: (['google', 'outlook'] as CalendarProvider[]).map(provider => ({
        provider,
        configured: Boolean(providerConfiguration(provider)),
        connected: byProvider.has(provider),
        email: byProvider.get(provider)?.providerEmail || null,
        updatedAt: byProvider.get(provider)?.updatedAt || null,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list calendar integrations');
    sendError(res, 'INTEGRATION_FETCH_FAILED', 'Could not load integrations.', 500);
  }
};

export const startCalendarIntegration = async (req: AuthRequest, res: Response): Promise<void> => {
  const provider = providerFromParam(String(req.params.provider || ''));
  const config = provider ? providerConfiguration(provider) : null;
  const clerkId = req.clerkId;
  if (!provider || !config || !stateSecret()) { sendError(res, 'INTEGRATION_NOT_CONFIGURED', 'This calendar provider has not been configured yet.', 503); return; }
  if (!clerkId) { sendError(res, 'AUTH_ERROR', 'Authentication required.', 401); return; }
  try {
    const statePayload: StatePayload = { clerkId, provider };
    const state = jwt.sign(statePayload, stateSecret()!, { expiresIn: '10m' });
    const url = new URL(config.authorizeUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', config.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scopes.join(' '));
    url.searchParams.set('state', state);
    if (provider === 'google') { url.searchParams.set('access_type', 'offline'); url.searchParams.set('prompt', 'consent'); }
    sendSuccess(res, { authorizationUrl: url.toString() });
  } catch (error) {
    logger.error({ error }, 'Failed to start calendar OAuth flow');
    sendError(res, 'INTEGRATION_START_FAILED', 'Could not start the calendar connection.', 500);
  }
};

export const calendarOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  const provider = providerFromParam(String(req.params.provider || ''));
  const config = provider ? providerConfiguration(provider) : null;
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const errorDescription = typeof req.query.error_description === 'string' ? req.query.error_description : '';
  if (!provider || !config || !stateSecret() || !code) { res.redirect(302, appendMobileResult({ integration: provider || 'unknown', status: 'failed', reason: errorDescription || 'authorization_failed' })); return; }
  try {
    const payload = jwt.verify(state, stateSecret()!) as StatePayload;
    if (payload.provider !== provider || !payload.clerkId) throw new Error('Invalid OAuth state.');
    const user = await User.findOne({ clerkId: payload.clerkId });
    if (!user) throw new Error('User not found.');
    const tokenResponse = await fetch(config.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: config.redirectUri, grant_type: 'authorization_code' }).toString() });
    if (!tokenResponse.ok) throw new Error(`Token exchange failed (${tokenResponse.status}).`);
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!token.access_token) throw new Error('Calendar provider did not return an access token.');
    const existing = await CalendarIntegration.findOne({ userId: user._id, provider }).select('+encryptedRefreshToken');
    const providerEmail = provider === 'google'
      ? (jwt.decode(token.access_token) as { email?: string } | null)?.email
      : undefined;
    await CalendarIntegration.findOneAndUpdate(
      { userId: user._id, provider },
      { userId: user._id, provider, providerEmail, encryptedAccessToken: encryptIntegrationToken(token.access_token), encryptedRefreshToken: token.refresh_token ? encryptIntegrationToken(token.refresh_token) : existing?.encryptedRefreshToken, accessTokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : undefined, scope: (token.scope || config.scopes.join(' ')).split(' ').filter(Boolean) },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    res.redirect(302, appendMobileResult({ integration: provider, status: 'connected' }));
  } catch (error) {
    logger.error({ error, provider }, 'Calendar OAuth callback failed');
    res.redirect(302, appendMobileResult({ integration: provider || 'unknown', status: 'failed', reason: 'connection_failed' }));
  }
};

export const disconnectCalendarIntegration = async (req: AuthRequest, res: Response): Promise<void> => {
  const provider = providerFromParam(String(req.params.provider || ''));
  if (!provider) { sendError(res, 'INVALID_PROVIDER', 'Unsupported calendar provider.'); return; }
  try {
    const user = await User.findOne({ clerkId: req.clerkId });
    if (!user) { sendError(res, 'USER_NOT_FOUND', 'User not found.', 404); return; }
    await CalendarIntegration.deleteOne({ userId: user._id, provider });
    sendSuccess(res, { provider, disconnected: true });
  } catch (error) {
    logger.error({ error, provider }, 'Failed to disconnect calendar integration');
    sendError(res, 'INTEGRATION_DISCONNECT_FAILED', 'Could not disconnect this calendar.', 500);
  }
};

const activeAccessToken = async (userId: string, provider: CalendarProvider): Promise<string> => {
  const config = providerConfiguration(provider);
  const integration = await CalendarIntegration.findOne({ userId, provider }).select('+encryptedAccessToken +encryptedRefreshToken');
  if (!config || !integration?.encryptedAccessToken) throw new Error('This calendar is not connected.');
  if (!integration.accessTokenExpiresAt || integration.accessTokenExpiresAt.getTime() > Date.now() + 60_000) return decryptIntegrationToken(integration.encryptedAccessToken);
  if (!integration.encryptedRefreshToken) throw new Error('Reconnect this calendar to continue.');
  const refreshToken = decryptIntegrationToken(integration.encryptedRefreshToken);
  const refreshResponse = await fetch(config.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token', ...(provider === 'outlook' ? { scope: config.scopes.join(' ') } : {}) }).toString() });
  if (!refreshResponse.ok) throw new Error('Calendar authorization expired. Reconnect this calendar to continue.');
  const refreshed = await refreshResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!refreshed.access_token) throw new Error('Calendar provider did not return a refreshed access token.');
  integration.encryptedAccessToken = encryptIntegrationToken(refreshed.access_token);
  if (refreshed.refresh_token) integration.encryptedRefreshToken = encryptIntegrationToken(refreshed.refresh_token);
  integration.accessTokenExpiresAt = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : undefined;
  await integration.save();
  return refreshed.access_token;
};

export const createCalendarEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  const provider = providerFromParam(String(req.params.provider || ''));
  if (!provider) { sendError(res, 'INVALID_PROVIDER', 'Unsupported calendar provider.'); return; }
  try {
    const user = await User.findOne({ clerkId: req.clerkId });
    if (!user) { sendError(res, 'USER_NOT_FOUND', 'User not found.', 404); return; }
    const accessToken = await activeAccessToken(String(user._id), provider);
    const title = String(req.body.title || '').trim();
    const startsAt = new Date(String(req.body.startsAt));
    const endsAt = new Date(String(req.body.endsAt));
    const description = String(req.body.description || '').trim();
    if (!title || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) { sendError(res, 'INVALID_EVENT', 'Provide an event title and valid start and end times.'); return; }
    const eventResponse = provider === 'google'
      ? await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: title, description, start: { dateTime: startsAt.toISOString() }, end: { dateTime: endsAt.toISOString() } }) })
      : await fetch('https://graph.microsoft.com/v1.0/me/events', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: title, body: { contentType: 'text', content: description }, start: { dateTime: startsAt.toISOString(), timeZone: 'UTC' }, end: { dateTime: endsAt.toISOString(), timeZone: 'UTC' } }) });
    if (!eventResponse.ok) throw new Error(`Calendar provider rejected the event (${eventResponse.status}).`);
    const event = await eventResponse.json() as { id?: string; htmlLink?: string; webLink?: string };
    sendSuccess(res, { eventId: event.id, url: event.htmlLink || event.webLink || null }, 201);
  } catch (error: any) {
    logger.error({ error, provider }, 'Failed to create calendar event');
    sendError(res, 'CALENDAR_EVENT_FAILED', error.message || 'Could not create the calendar event.', 502);
  }
};

// Retained as a service boundary for the event-publishing phase; tokens never leave the server.
export const getCalendarAccessToken = async (userId: string, provider: CalendarProvider): Promise<string | null> => {
  try { return await activeAccessToken(userId, provider); } catch { return null; }
};
