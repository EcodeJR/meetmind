# MeetMind — AI Coding Agent Build Guide

## What You Are Building
A mobile-first AI meeting transcription app for physical/in-person meetings.
Users open the app, tap record, have their meeting, and receive a full transcript + AI summary with action items when done.

---

## Tech Stack
- **Mobile:** React Native + Expo (managed workflow)
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose
- **Auth:** Clerk (React Native SDK)
- **Transcription:** OpenAI Whisper API
- **AI Summarization:** Anthropic Claude API (claude-sonnet-4-20250514) also use gemini API as fallback
- **File Storage:** Cloudinary (audio uploads)
- **Payments:** Stripe
- **Backend Deployment:** Railway
- **Mobile Builds:** Expo EAS

---

## Project Structure

```
meetmind/
├── mobile/                  # React Native Expo app
│   ├── app/                 # Expo Router file-based routing
│   │   ├── (auth)/          # Auth screens (sign-in, sign-up)
│   │   ├── (tabs)/          # Main tab screens
│   │   │   ├── index.tsx    # Home / record screen
│   │   │   ├── history.tsx  # Past meetings list
│   │   │   └── settings.tsx # User settings
│   │   └── meeting/         # Meeting detail screens
│   ├── components/          # Reusable UI components
│   ├── hooks/               # Custom hooks
│   ├── services/            # API call functions
│   ├── store/               # Global state (Zustand)
│   ├── utils/               # Helper functions
│   └── constants/           # Colors, config, strings
│
└── backend/                 # Node.js Express API
    ├── src/
    │   ├── controllers/     # Route handler logic
    │   ├── routes/          # Express route definitions
    │   ├── models/          # Mongoose schemas
    │   ├── middleware/       # Auth, error handling, rate limiting
    │   ├── services/        # Whisper, Claude, Cloudinary logic
    │   └── utils/           # Helpers
    ├── .env
    └── server.js
```

---

## Build Order (Follow This Exactly)

### Phase 1 — Backend Foundation
1. Initialise Node/Express project with TypeScript
2. Connect MongoDB via Mongoose
3. Set up Clerk webhook middleware to sync users into your DB
4. Create User model (clerkId, email, plan, storageUsed, createdAt)
5. Create Meeting model (see schema below)
6. Set up error handling middleware globally
7. Set up rate limiting middleware on all routes
8. Create health check endpoint

### Phase 2 — Audio Pipeline
1. Set up Cloudinary for audio file storage
2. Create upload endpoint that accepts audio files and returns a Cloudinary URL
3. Create transcription service that sends audio URL to OpenAI Whisper API and returns raw transcript text
4. Create summarization service that sends raw transcript to Claude API and returns structured JSON (summary, actionItems, keyDecisions, title)
5. Create the full meeting processing endpoint: receive audio → upload → transcribe → summarize → save to DB → return to client

### Phase 3 — Meeting Routes
1. POST /meetings/process — full pipeline (upload + transcribe + summarize + save)
2. GET /meetings — paginated list for authenticated user
3. GET /meetings/:id — single meeting detail
4. PATCH /meetings/:id — update title or tags
5. DELETE /meetings/:id — delete meeting and Cloudinary audio file
6. GET /meetings/search?q= — search transcripts by keyword

### Phase 4 — Mobile App Foundation
1. Initialise Expo project with Expo Router
2. Install and configure Clerk Expo SDK
3. Build sign-in and sign-up screens
4. Set up Zustand store for global state
5. Set up axios instance in services/ with auth token interceptor
6. Build bottom tab navigation structure

### Phase 5 — Core Recording Screen
1. Request microphone permissions on app load
2. Build recording UI: large record button, waveform visualizer, live timer
3. Implement background audio recording using expo-av
4. On stop: show processing state, upload audio to backend, poll or await response
5. On completion: navigate to meeting detail screen

### Phase 6 — Meeting Detail Screen
1. Display AI-generated title and date
2. Display summary paragraph
3. Display action items as a checklist
4. Display key decisions section
5. Display full scrollable transcript with speaker labels
6. Export button — generate PDF and share via native share sheet
7. Copy action items button

### Phase 7 — History Screen
1. Paginated flat list of past meetings
2. Each card shows: title, date, duration, first line of summary
3. Pull-to-refresh
4. Search bar that queries the search endpoint

### Phase 8 — Settings & Paywall
1. Account info screen (name, email, plan badge)
2. Storage usage bar
3. Language preference selector
4. Stripe paywall for Pro plan (monthly/annual toggle)
5. Manage subscription screen
6. Delete account flow

---

## MongoDB Schemas

**User**
- clerkId (string, unique, required)
- email (string, required)
- plan (enum: free | pro, default: free)
- meetingCount (number, default: 0)
- storageUsedMB (number, default: 0)
- createdAt (date)

**Meeting**
- userId (ObjectId ref User, required)
- title (string)
- rawTranscript (string)
- summary (string)
- actionItems (array of strings)
- keyDecisions (array of strings)
- speakers (array: { label, totalSeconds })
- durationSeconds (number)
- audioUrl (string — Cloudinary URL)
- language (string, default: en)
- tags (array of strings)
- createdAt (date)

---

## Claude Prompt Structure (Summarization Service)
The system prompt must instruct Claude to return only valid JSON with this exact shape:
- title: string
- summary: string (2-4 sentences)
- actionItems: string[] (each item starts with a verb, includes owner if mentioned)
- keyDecisions: string[]

Tell Claude: respond with raw JSON only, no markdown, no preamble.

---

## Free Plan Limits
Enforce these in the backend before processing:
- Maximum 10 meetings per month
- Maximum 30 minutes recording per meeting
- No export feature
- Transcripts stored for 90 days only

Pro plan removes all limits. Check limits in a middleware before hitting the processing endpoint.

---

## Rules for the AI Agent

### DO
- Use TypeScript everywhere (mobile and backend)
- Validate all request bodies with Zod on the backend
- Use environment variables for every secret and API key — never hardcode
- Handle all API errors gracefully and return consistent JSON error shapes
- Use async/await, never raw promise chains
- Keep controllers thin — business logic lives in services/
- Use Expo managed workflow unless a bare workflow is explicitly needed
- Use Expo Router for all navigation
- Store the Clerk JWT in Expo SecureStore, never AsyncStorage
- Use React Query (TanStack Query) for all server state in the mobile app
- Compress audio before uploading — target under 10MB per recording

### DO NOT
- Do not build authentication from scratch — Clerk handles everything
- Do not store audio files in MongoDB — always use Cloudinary
- Do not call Whisper or Claude directly from the mobile app — always go through your backend
- Do not skip loading and error states on any screen
- Do not use inline styles — use StyleSheet.create() or a consistent style system
- Do not use any deprecated Expo APIs
- Do not use class components — hooks only
- Do not commit .env files
- Do not process audio longer than 30 minutes in a single Whisper call — chunk if needed
- Do not use console.log in production — use a proper logger (pino)

---

## Environment Variables

**Backend (.env)**
- PORT
- MONGODB_URI
- CLERK_SECRET_KEY
- CLERK_WEBHOOK_SECRET
- OPENAI_API_KEY
- ANTHROPIC_API_KEY
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- CLIENT_URL

**Mobile (.env)**
- EXPO_PUBLIC_API_URL
- EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
- EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY

---

## Error Handling Convention
All backend errors must return this shape:
```
{ success: false, error: { code: string, message: string } }
```
All success responses:
```
{ success: true, data: {} }
```
Never expose stack traces or internal error messages to the client in production.

---

## Security Checklist
- All routes except health check must require a valid Clerk JWT
- Verify Clerk webhook signatures before processing webhook events
- Users can only access their own meetings — always filter by userId from the verified token, never from request body
- Stripe webhook signature must be verified before fulfilling plan upgrades
- Set CORS to allow only your mobile app origin in production
- Add helmet.js to all Express responses

---

## Key Libraries

**Mobile**
- expo-av — audio recording
- expo-file-system — local file handling
- expo-sharing — native share sheet
- expo-secure-store — token storage
- @clerk/clerk-expo — auth
- @tanstack/react-query — server state
- zustand — global UI state
- axios — HTTP client
- react-native-reanimated — animations
- @stripe/stripe-react-native — payments

**Backend**
- express — server
- mongoose — MongoDB ODM
- @clerk/clerk-sdk-node — JWT verification
- openai — Whisper API
- @anthropic-ai/sdk — Claude API
- cloudinary — file storage
- stripe — payments
- zod — request validation
- pino — logging
- helmet — security headers
- express-rate-limit — rate limiting
- multer — file upload handling

---

## MVP Definition
The app is ready for first users when these work end-to-end:
1. User can sign up and sign in
2. User can record a meeting on their phone
3. App transcribes and returns a summary with action items
4. User can view all past meetings
5. User can export a meeting summary
6. Free plan limits are enforced
7. Pro plan can be purchased via Stripe