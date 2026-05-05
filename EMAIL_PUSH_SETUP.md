# Email & Push Notifications Setup Guide

## Overview

Memovoice now includes comprehensive notification features:
- ✅ **Email notifications** for sign-ups, meeting events, and failures (Gmail via nodemailer)
- ✅ **Push notifications** for meeting recording, transcription, completion, and failures (Expo Notifications)
- ✅ **Fixed UX issue** where subscription plan showed as "pro" before loading

## Backend Setup

### 1. Email Service Configuration

**Environment Variables Required:**
```bash
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
```

**Getting Gmail App Password:**
1. Enable 2-Factor Authentication on your Google Account
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer" (or your platform)
4. Generate the app password
5. Use this password in `GMAIL_APP_PASSWORD`

**Email Events Triggered:**
- **Sign-up**: Welcome email sent automatically when user creates account
- **Meeting Recording Started**: Optional email notification
- **Meeting Processing**: 
  - ✅ Success: Email with summary and key points
  - ❌ Failed: Email with error details
- **Subscription Upgrade**: Confirmation email with Pro benefits

### 2. Backend Services Added

**New Files:**
- `backend/src/services/emailService.ts` - Email sending with Gmail
- `backend/src/services/pushNotificationService.ts` - Expo push notifications
- `backend/src/controllers/userController.ts` - Updated with push token management

**New Endpoints:**
- `PATCH /api/users/push-token` - Register Expo push token

**User Model Updates:**
- Added `expoPushToken` field to store device push tokens
- Tracks push notification preferences

## Mobile Setup

### 1. Push Notification Configuration

**Environment Variables Required:**
```bash
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

**Get Project ID:**
1. Run `expo config` in your mobile directory
2. Find `projectId` in the output
3. Or set it in `app.json` under `expo.projectId`

### 2. Mobile Services Added

**New Files:**
- `mobile/services/pushNotificationService.ts` - Push token registration hook

**Usage in Components:**
```tsx
import { usePushNotifications } from '@/services/pushNotificationService';

export default function MyComponent() {
  usePushNotifications(); // Call this once in your root layout or main screen
  
  // Rest of component...
}
```

### 3. Notification Handling

The app automatically handles:
- **Notification tap/open** - Logs notification data
- **Multiple notification types**:
  - `meeting_started` - Recording began
  - `transcription_started` - Processing started
  - `meeting_processed` - Success with summary preview
  - `meeting_failed` - Error notification
  - `payment_success` - Payment confirmation

## How It Works

### Meeting Processing Flow

```
1. User uploads audio via mobile app
2. Backend sends push notification: "⏳ Transcription in Progress"
3. Audio is transcribed from Cloudinary
4. Summary & key points are generated
5. On Success:
   - Send push notification with summary preview
   - Send email with full summary and action items
   - Display in app
6. On Failure:
   - Send push notification with error
   - Send email with error details and retry instructions
```

### Email Templates

All emails are HTML formatted with:
- Consistent branding (Memovoice logo, colors)
- Mobile-friendly layouts
- Clear call-to-action buttons
- Error details when applicable

## Testing

### Test Welcome Email
```bash
# Backend logs show email verification:
# "Email service verified and ready to send emails"

# When user signs up, check:
# - Backend logs: "Welcome email sent successfully"
# - Gmail account: Check inbox for welcome email
```

### Test Meeting Processing Emails
```bash
# Upload a meeting via mobile app or API
# Check backend logs for:
# - "Transcription started notification sent"
# - "Meeting processed email sent"

# Check Gmail inbox for email with subject:
# "Meeting Summary Ready - [Meeting Title]"
```

### Test Push Notifications (Local)
```bash
# 1. Get device Expo Push Token from logs:
# "[PUSH] Obtained token: ExponentPushToken[...]"

# 2. Send test notification via Expo API:
curl -X POST https://exp.host/--/api/v2/push/send \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "ExponentPushToken[...]",
    "sound": "default",
    "title": "Test",
    "body": "This is a test notification"
  }'

# 3. Check mobile device notification center
```

## Troubleshooting

### Emails Not Sending
- Check `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set correctly
- Verify Gmail App Password (not regular password)
- Check backend logs: `"Email service verification failed"` indicates auth issue
- Less secure apps must be enabled if not using App Passwords

### Push Notifications Not Arriving
- Verify `EXPO_PUBLIC_PROJECT_ID` is correct
- Confirm device has Expo push token (check logs)
- Check notification permissions granted on device
- Verify user has `expoPushToken` saved (check MongoDB user record)

### Wrong Subscription Plan Displayed
- Fixed! Settings screen now shows loading spinner while fetching data
- Default falls back to "free" instead of "pro"
- Plan badge only displays when data is loaded

## Important Notes

⚠️ **Security:**
- Gmail App Password should be treated like a password
- Never commit `.env` to version control
- Use environment variables in production

⚠️ **Rate Limits:**
- Gmail: ~500 emails per day per account
- Expo Push: Reasonable limits, check Expo docs for details

⚠️ **Preferences:**
- Users can disable email/push notifications in settings
- Currently all notifications send by default
- Backend respects user preferences: `preferences.pushNotificationsEnabled`

## Next Steps

1. **Set up Expo account** (if not already done):
   - Go to https://expo.dev
   - Create account and connect to your project

2. **Configure Gmail** for your domain/support email

3. **Deploy to Railway/production**:
   - Add environment variables to Railway dashboard
   - Redeploy backend

4. **Test end-to-end**:
   - Create test account
   - Upload meeting
   - Verify email and push notification received

5. **Monitor**:
   - Check email delivery rates
   - Monitor push notification failures in Expo dashboard
   - Review application logs

## API Reference

### Email Service Functions

```typescript
// Send welcome email (called automatically on sign-up)
sendWelcomeEmail(email: string, firstName: string): Promise<boolean>

// Send meeting success email (called after processing complete)
sendMeetingProcessedEmail(
  email: string,
  userName: string,
  meetingTitle: string,
  summary: string
): Promise<boolean>

// Send meeting failure email (called on processing error)
sendMeetingFailedEmail(
  email: string,
  userName: string,
  meetingTitle: string,
  errorMessage: string
): Promise<boolean>

// Send subscription upgrade email
sendSubscriptionUpgradeEmail(
  email: string,
  userName: string
): Promise<boolean>
```

### Push Notification Service Functions

```typescript
// Send transcription started notification
sendTranscriptionStartedNotification(
  expoPushToken: string,
  meetingTitle?: string
): Promise<boolean>

// Send meeting processed notification
sendMeetingProcessedNotification(
  expoPushToken: string,
  meetingTitle: string,
  summaryPreview?: string
): Promise<boolean>

// Send meeting failed notification
sendMeetingFailedNotification(
  expoPushToken: string,
  meetingTitle: string,
  errorMessage?: string
): Promise<boolean>

// Send payment notification
sendPaymentNotification(
  expoPushToken: string,
  amount: number,
  currency: string,
  plan: string
): Promise<boolean>
```

## Files Modified

**Backend:**
- `src/services/emailService.ts` (NEW)
- `src/services/pushNotificationService.ts` (NEW)
- `src/controllers/meetingController.ts` (updated with notifications)
- `src/controllers/userController.ts` (updated with push token)
- `src/models/User.ts` (added expoPushToken field)
- `src/routes/userRoutes.ts` (added push-token endpoint)

**Mobile:**
- `services/pushNotificationService.ts` (NEW)
- `app/_layout.tsx` (added push notification hook)
- `app/(tabs)/settings.tsx` (fixed subscription UX)

**Dependencies Added:**
- Backend: `nodemailer`, `@types/nodemailer`
