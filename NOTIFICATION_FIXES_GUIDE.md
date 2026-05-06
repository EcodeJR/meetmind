# 🔧 Production Notification Fixes - Setup & Troubleshooting Guide

## Summary of Issues & Fixes

### Issue 1: Gmail SMTP Timeout (Email Delivery Failing)
**Symptoms:** `ETIMEDOUT on CONN` and `ESOCKET -101` errors in production logs

**Root Cause:** Railway firewall is blocking SMTP port 465 (IPv6 connection failure)

**Fix Implemented:**
- ✅ Changed from port 465 (SSL) to port 587 (TLS) for better compatibility
- ✅ Added detailed error logging with troubleshooting hints
- ✅ Improved transporter error handling

**What You Need to Do:**

1. **Verify Gmail Credentials on Railway:**
   ```
   Open Railway Dashboard → Your Memovoice Deployment → Variables
   Check that these are set:
   - GMAIL_USER=memovoiceio@gmail.com
   - GMAIL_APP_PASSWORD=dfhx lnyh kdjq fuaw (app password with spaces)
   ```

2. **Critical: Use Gmail App Password (not account password)**
   - If you have 2FA enabled on Gmail, you MUST use an App Password
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Copy the 16-character password (it has spaces)
   - Set it as `GMAIL_APP_PASSWORD` on Railway

3. **Verify Railway Outbound Access:**
   - The fix uses port 587 which is more reliable than 465
   - If email still fails, check Railway's network policies

4. **Fallback Option:**
   If Gmail continues to timeout on Railway, switch to a simpler provider:
   - **Brevo (formerly Sendinblue):** Free tier, simple SMTP
   - **Mailgun:** 1000 free emails/month
   - **AWS SES:** Lowest cost at scale

---

### Issue 2: Mobile Push Notifications Not Appearing
**Symptoms:** Code executes without errors, but no notification bar popup on device

**Root Causes:**
- ❌ `EXPO_PUBLIC_PROJECT_ID` environment variable not set
- ❌ Android notification channel not configured
- ❌ Device notification permissions not granted

**Fixes Implemented:**
- ✅ Added `configureNotifications()` for Android notification channel setup
- ✅ Added detailed logging to identify missing project ID
- ✅ Enhanced push token registration logging
- ✅ Added both foreground and background notification handlers
- ✅ Created `.env.example` template for mobile

---

## 🚀 Critical Setup Steps (DO THIS FIRST)

### Step 1: Get Your Expo Project ID
Run this command from the mobile directory:
```bash
cd mobile
npx eas project info
```

Look for `projectId:` in the output. Example:
```
projectId: 12ab34cd-56ef-7890-abcd-ef1234567890
```

### Step 2: Create Mobile .env File
Create `/mobile/.env` with:
```env
EXPO_PUBLIC_PROJECT_ID=12ab34cd-56ef-7890-abcd-ef1234567890
EXPO_PUBLIC_API_URL=https://your-railway-url.railway.app
```

### Step 3: Redeploy Backend with Fix
Push your code to production:
```bash
git add .
git commit -m "Fix: Gmail SMTP port 587 + Android notification channel config"
git push origin main
```
Railway will auto-redeploy.

### Step 4: Rebuild & Redeploy Mobile App
```bash
cd mobile
npx eas build --platform android --build-type internal  # or ios
npx eas submit  # if using EAS Submit
```

---

## 🧪 Testing Checklist

### Email Testing (Backend)
- [ ] Check Railway logs show: "Email service verified and ready to send emails"
- [ ] Create a test user → should receive welcome email
- [ ] Trigger a meeting upload → should receive meeting processed email
- [ ] If ETIMEDOUT still appears, check Railway variables

### Push Notification Testing (Mobile)
- [ ] Build and install latest mobile app on test device
- [ ] Open Settings → Notifications
- [ ] Verify "Push Notifications" toggle is available
- [ ] Tap "Register Device" button
- [ ] Check DevTools console for "[PUSH] Successfully obtained Expo token"
- [ ] In Database (MongoDB), verify user has `expoPushToken` field populated
- [ ] Record a test meeting
- [ ] Verify notification appears on phone notification bar:
  - 🎙️ "Recording Started"
  - ⏳ "Transcription In Progress"
  - ✅ "Meeting Processed"

---

## 📊 Diagnostic Logs to Check

### Backend Email Service (Railway Console)
Look for these messages:
```
✅ GOOD: "Email service verified and ready to send emails"
❌ BAD: "Email service verification failed - notifications will not be sent"
         "code": "ETIMEDOUT"  →  Firewall blocking port 465
         "code": "ESOCKET"    →  Connection failed
```

### Mobile Push Registration (Console/DevTools)
Look for these logs:
```
✅ GOOD: "[PUSH] Successfully obtained Expo token: Expx..."
         "[PUSH] Backend sync successful: 200"
         "[PUSH] Notification received (foreground):"

❌ BAD: "[PUSH] EXPO_PUBLIC_PROJECT_ID not configured"
        "[PUSH] Failed to register push token:"
        "[PUSH] Failed to sync push token with backend:"
```

### Backend Push Notification (Railway Console)
```
✅ GOOD: "Push notification sent successfully to Expo API"
         "ticketId": "XXXXXXX"

❌ BAD: "Failed to send push notification via Expo API"
        "Push notification sent with errors"
```

---

## 🔍 Common Issues & Solutions

### 1. Gmail Still Timing Out
```
Error: ETIMEDOUT on port 587
Solution:
- Verify GMAIL_APP_PASSWORD is correct (get from https://myaccount.google.com/apppasswords)
- Check if Gmail is rate-limiting - wait 10 minutes and retry
- Switch to Brevo/Mailgun if Railway blocking SMTP entirely
```

### 2. Expo Project ID Missing
```
Error: "[PUSH] EXPO_PUBLIC_PROJECT_ID not configured"
Solution:
1. Run: npx eas project info
2. Copy projectId
3. Add to mobile/.env: EXPO_PUBLIC_PROJECT_ID=<project-id>
4. Rebuild app
```

### 3. Notification Permissions Denied
```
Android: Settings → Apps → Memovoice → Notifications → Allow
iOS: Settings → Memovoice → Notifications → Allow
```

### 4. Device Token Not Syncing
```
In MongoDB, check user document:
db.users.findOne({clerkId: "user_..."}).expoPushToken
Should contain: "ExponentPushToken[...]"
If null/missing:
- User needs to toggle "Push Notifications" on in Settings
- Then tap "Register Device"
- Watch DevTools for "[PUSH] Backend sync successful: 200"
```

### 5. Notification Arrives but No System Bar Popup
```
❌ Local notifications (alert in app) showing? 
   → Expo notification channel might not be set up
   → Solution: App will set up channel on first launch

❌ Remote notifications (phone bar) not showing?
   → Check if Expo token actually sent to backend
   → Verify project ID is correct
   → Check Expo API receipt: https://exp.host/--/api/v2/push/tickets
```

---

## 📈 Performance Notes

### Email Service Changes
- Old: Port 465 (SSL) - Blocks on Railway
- New: Port 587 (TLS) - Better compatibility
- Timeout: 10 seconds per email (same as before)

### Push Notification Service
- No changes to API endpoint
- Added detailed logging for debugging
- Timeout: 10 seconds per notification (same)

---

## 🚨 If Still Having Issues

### For Email:
1. Check Railway variables are actually set (not using defaults)
2. Try a different email provider (Brevo, Mailgun)
3. Look at exact error code in logs:
   - ETIMEDOUT = connection timeout
   - ESOCKET = socket error
   - EAUTH = authentication failed

### For Push Notifications:
1. Verify `db.users.findOne().expoPushToken` is populated
2. Check Expo push receipts: https://exp.host/--/api/v2/push/tickets
3. Ensure app has notification permissions on device
4. Try rebuilding with `npx eas build --clear-cache`

---

## 📋 Files Modified

| File | Change | Impact |
|------|--------|--------|
| `backend/src/services/emailService.ts` | Port 587 (TLS) + better logging | Email delivery on Railway |
| `backend/src/services/pushNotificationService.ts` | Enhanced logging | Debugging push failures |
| `mobile/services/pushNotificationService.ts` | Added Android channel + logging | Push notifications appear |
| `mobile/app/_layout.tsx` | Call `configureNotifications()` | Android channel set up |
| `mobile/.env.example` | New template | User knows what to set |

---

## ✅ Success Indicators

When everything is working:

**Backend Logs:**
```
✅ "Email service verified and ready to send emails"
✅ "Push notification sent successfully to Expo API"
```

**Mobile Console:**
```
✅ "[PUSH] Successfully obtained Expo token: Expx..."
✅ "[PUSH] Backend sync successful: 200"
✅ "[PUSH] Notification received (foreground): ✅ Meeting Processed"
```

**User Experience:**
- Welcome email arrives after signup ✅
- Phone notification bar shows "🎙️ Recording Started" when recording begins ✅
- Phone notification bar shows "✅ Meeting Processed" when meeting finishes ✅
- Meeting appears in history with transcript ✅

---

**Next:** Follow the "Critical Setup Steps" above, then test with the testing checklist.
