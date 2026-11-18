# Calendar integrations setup

The calendar connection feature is implemented but intentionally remains unavailable until provider credentials are configured. Tokens are encrypted before they are written to MongoDB.

## Render environment variables

Set these in the backend Render service:

```text
INTEGRATION_ENCRYPTION_KEY=<64-character hexadecimal key>
INTEGRATIONS_STATE_SECRET=<long random secret>
MOBILE_OAUTH_REDIRECT_URI=memovoice://settings/integrations

GOOGLE_CALENDAR_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CALENDAR_CLIENT_SECRET=<Google OAuth client secret>
GOOGLE_CALENDAR_REDIRECT_URI=https://YOUR-BACKEND/api/integrations/oauth/google/callback

MICROSOFT_CALENDAR_CLIENT_ID=<Microsoft application client ID>
MICROSOFT_CALENDAR_CLIENT_SECRET=<Microsoft application client secret>
MICROSOFT_CALENDAR_REDIRECT_URI=https://YOUR-BACKEND/api/integrations/oauth/outlook/callback
```

Generate the encryption key once and retain it securely. Changing it later prevents the backend from decrypting existing calendar tokens.

```bash
openssl rand -hex 32
```

## Provider configuration

- Register the Google redirect URI above and enable the Google Calendar API for the OAuth project. The app requests `calendar.events` access.
- Register the Microsoft redirect URI above in the application’s web-platform configuration. The app requests delegated `Calendars.ReadWrite` access.
- Keep client secrets only in Render. Do not put them in the mobile Expo environment.

Once deployed, open **Settings → Calendar Integrations** in the mobile app. A provider displays “Coming soon” until its variables are present, then users can connect and disconnect it.

Connected users can tap the calendar icon on an action item to create a one-hour follow-up event. It uses 9:00 AM on the action due date, or 9:00 AM tomorrow when the action has no due date.
