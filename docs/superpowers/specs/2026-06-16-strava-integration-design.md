# Strava Integration Design Spec

**Date:** 2026-06-16
**Branch:** JT-4

---

## Goal

Connect Ocht to Strava so that training context, derived performance metrics, and race-time predictions are populated automatically from real activity data rather than manual form entry. Offered during onboarding at the highest-intent moment.

---

## Architecture Overview

Three logical layers:

1. **OAuth & token layer** — handles Strava OAuth 2.0, token encryption at rest, and silent token refresh before any API call
2. **Metrics computation layer** — reads raw Strava activities and computes derived metrics algorithmically (no LLM)
3. **Onboarding UI layer** — goal-first 2-screen flow; Strava connection offered contextually after goal selection

All Strava-derived data lives in two new DB tables (`StravaConnection`, `StravaProfile`) that can be deleted independently of the User record to satisfy Strava's data-deletion compliance requirement.

---

## Database Schema

Add to `prisma/schema.prisma`:

```prisma
model StravaConnection {
  id              String         @id @default(cuid())
  userId          String         @unique
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  stravaAthleteId Int            @unique
  accessToken     String         // AES-256-GCM encrypted, format: <iv>:<tag>:<ciphertext> (hex)
  refreshToken    String         // AES-256-GCM encrypted, same format
  expiresAt       DateTime
  scope           String
  connectedAt     DateTime       @default(now())
  revokedAt       DateTime?

  profile         StravaProfile?

  @@index([userId])
}

model StravaProfile {
  id                   String           @id @default(cuid())
  connectionId         String           @unique
  connection           StravaConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  userId               String           @unique
  // Derived metrics
  lthrBpm              Int?             // lactate threshold HR
  cardiacDecouplingPct Float?           // aerobic decoupling % (fade-risk predictor)
  ctlScore             Float?           // chronic training load (90-day fitness)
  atlScore             Float?           // acute training load (7-day fatigue)
  bestEffort5kSeconds  Int?
  bestEffort10kSeconds Int?
  paceZonesJson        Json?            // { z1..z5: { minPaceSec: number, maxPaceSec: number } }
  // Auto-fill values for trainingContext (lib/trainingContext.ts)
  runsPerWeek          Float?
  weeklyDistanceKm     Float?
  longestRunKm         Float?
  hardRunsPerWeek      Float?
  restDaysPerWeek      Float?
  lastSyncedAt         DateTime
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  @@index([userId])
}
```

Also add to `User` model:

```prisma
  onboardingCompletedAt DateTime?
  stravaConnection      StravaConnection?
```

---

## Environment Variables

Add to `.env` and `.env.example`:

```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_TOKEN_ENCRYPTION_KEY=   # 32-byte random, base64-encoded: openssl rand -base64 32
APP_URL=http://localhost:3000   # used to build callback URI
```

Redirect URI is derived at runtime as `${APP_URL}/api/strava/callback` — no separate env var.

---

## OAuth Flow

### Initiating the connection

`GET /api/strava/connect`

- Requires authenticated user (return 401 if not)
- Generates a CSRF state token: `HMAC-SHA256(userId + ":" + timestamp, STRAVA_CLIENT_SECRET)`, base64url-encoded, stored in a `strava_oauth_state` HttpOnly cookie (5-minute TTL)
- Redirects to:
  ```
  https://www.strava.com/oauth/authorize
    ?client_id=STRAVA_CLIENT_ID
    &redirect_uri=APP_URL/api/strava/callback
    &response_type=code
    &approval_prompt=auto
    &scope=activity:read_all,profile:read_all
    &state=<state_token>
  ```

### Handling the callback

`GET /api/strava/callback?code=<code>&state=<state>&scope=<scope>`

1. Verify `state` matches `strava_oauth_state` cookie; return 400 if mismatch
2. Clear the `strava_oauth_state` cookie
3. Exchange code: `POST https://www.strava.com/api/v3/oauth/token` with `client_id`, `client_secret`, `code`, `grant_type=authorization_code`
4. Encrypt `access_token` and `refresh_token` using `lib/stravaTokens.ts`
5. Upsert `StravaConnection` record for the current user
6. Enqueue background sync (call `syncStravaProfile(userId)` — see below)
7. Redirect to `/?strava=connected`

### Error handling

- If Strava returns `scope` that does not include `activity:read_all` — redirect to `/?strava=insufficient_scope`
- If exchange fails — redirect to `/?strava=error`

---

## Token Management — `lib/stravaTokens.ts`

**Encryption:** AES-256-GCM. Key = `Buffer.from(STRAVA_TOKEN_ENCRYPTION_KEY, 'base64')`. Each encrypt call generates a random 12-byte IV. Stored as `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.

**`getValidAccessToken(userId: string): Promise<string>`**

- Loads `StravaConnection` for user
- If `expiresAt > now + 5 minutes`, decrypt and return existing `accessToken`
- Otherwise: `POST https://www.strava.com/api/v3/oauth/token` with `grant_type=refresh_token`; re-encrypt and store new tokens + `expiresAt`; return new access token
- Throws `StravaTokenError` if refresh fails (triggers revocation UI)

---

## Strava API Client — `lib/stravaClient.ts`

Thin wrapper around Strava REST API. All functions accept `userId` and call `getValidAccessToken` internally.

```typescript
getAthlete(userId: string): Promise<StravaAthlete>
getActivities(userId: string, opts: { perPage: number; after: number }): Promise<StravaActivity[]>
```

Types `StravaAthlete` and `StravaActivity` defined in `lib/stravaTypes.ts` — only the fields Ocht actually uses (subset of Strava response).

Used fields from `StravaActivity`:
- `type` (filter to `Run`)
- `distance` (metres)
- `moving_time` (seconds)
- `elapsed_time` (seconds)
- `average_heartrate`, `max_heartrate`
- `average_speed`
- `start_date`
- `suffer_score`

---

## Metrics Computation — `lib/stravaMetrics.ts`

All pure functions. Input: array of `StravaActivity`. Output: partial `StravaProfile` fields.

### `computeTrainingContext(activities)`

Looks back 28 days of runs:
- `runsPerWeek` = count / 4
- `weeklyDistanceKm` = total km / 4
- `longestRunKm` = max single run distance
- `hardRunsPerWeek` = runs with suffer_score > 50 / 4
- `restDaysPerWeek` = 7 − (unique run days per week, averaged)

### `computeBestEfforts(activities)`

For each run, estimate 5k and 10k pace from `distance` and `moving_time` using a Riegel formula extrapolation (`t2 = t1 × (d2/d1)^1.06`). Return the best (fastest) predicted times across all runs with distance ≥ 3km.

### `computeLTHR(activities)`

Uses the 30-minute best-effort HR method: find runs where `moving_time >= 1800s` and `average_heartrate` is available; LTHR ≈ 95% of average HR during the best (highest avg HR) run in the last 90 days.

Returns `null` if no qualifying runs found.

### `computeCardiacDecoupling(activities)`

For each run > 60 min with HR data: split into first-half and second-half pace/HR ratios; decoupling % = `(HR:pace ratio second half − first half) / first half × 100`. Average across last 4 qualifying runs.

Values > 5% indicate aerobic fade risk (maps to existing `durability` dimension in `lib/readiness.ts`).

### `computeTrainingLoad(activities)`

Simple monotonic model (no HRV data available):
- ATL = exponential weighted average of daily training stress over 7 days (λ = 1/7)
- CTL = exponential weighted average over 42 days (λ = 1/42)
- Training stress per run = `(moving_time_min × average_heartrate) / 100`

### `computePaceZones(lthrBpm, bestEffort5kSeconds)`

Generates 5 pace zones based on LTHR (if available) or 5k pace (fallback):
- Z1 (easy): > 140% 5k pace
- Z2 (aerobic): 120–140% 5k pace
- Z3 (tempo): 105–120% 5k pace
- Z4 (threshold): 100–105% 5k pace
- Z5 (VO2 max): < 100% 5k pace

---

## Background Sync — `lib/stravaSyncService.ts`

`syncStravaProfile(userId: string): Promise<void>`

1. Fetch last 90 days of runs from Strava (paginated, 200 per page)
2. Run all metric computations
3. Upsert `StravaProfile` record
4. Update `lastSyncedAt`

Called:
- After initial OAuth callback
- On-demand via `POST /api/strava/sync` (rate-limited: once per hour per user)

No webhook sync in this spec — polling on-demand is sufficient for v1.

---

## API Routes

### `GET /api/strava/connect`
Redirect to Strava OAuth. Requires auth.

### `GET /api/strava/callback`
OAuth callback. Validates state, exchanges code, stores tokens, triggers sync, redirects.

### `GET /api/strava/status`
Returns `{ connected: boolean, syncedAt: string | null, hasProfile: boolean }`. Used by onboarding UI and settings modal to show connection state.

### `POST /api/strava/sync`
Re-runs `syncStravaProfile` for the authenticated user. Rate-limited to 1 call/hour/user via `guardBrowserMutation`. Returns `{ ok: true }`.

### `DELETE /api/strava/connection`
1. Call Strava token deauthorisation endpoint: `POST https://www.strava.com/oauth/deauthorize`
2. Delete `StravaProfile` record
3. Delete `StravaConnection` record
4. Return `{ ok: true }`

This satisfies Strava's requirement that all derived data is removed on disconnection. The `User` record and `RaceReport` records are unaffected.

Account deletion (`DELETE /api/auth/me`) already cascades to `StravaConnection` (and via that to `StravaProfile`) via Prisma `onDelete: Cascade`.

---

## Onboarding UI

### Trigger

`OnboardingModal` is shown when:
- User is authenticated
- `user.onboardingCompletedAt === null`

Shown as a full-screen modal (above everything). Completing any path sets `onboardingCompletedAt` via `PATCH /api/auth/me`.

### Components

**`components/onboarding/OnboardingModal.tsx`**
- Client component
- State: `step` ('goal' | 'strava' | 'done'), `goal` ('results' | 'training' | 'explore')
- Traps focus, Escape does nothing (user must pick a path)
- On completion: calls `PATCH /api/auth/me` with `{ onboardingCompleted: true }`, closes

**`components/onboarding/GoalScreen.tsx`**
- Renders the 3-option stacked row layout (approved design, data/analytics SVG icons)
- On select: sets `goal`, advances to `step: 'strava'` for `results` and `training` paths; sets `step: 'done'` for `explore`

**`components/onboarding/StravaConnectScreen.tsx`**
- Renders Ocht × Strava lockup header (Option A, approved)
- Benefits list (4 bullets)
- "Connect with Strava" button → links to `/api/strava/connect`
- "Skip — enter details manually" button → advances to `step: 'done'`
- Copy adapts slightly between `results` path ("We'll also pre-fill your training background") and `training` path ("We'll predict your target time")

### Path routing after onboarding

| Goal | Strava connected | Landing |
|------|-----------------|---------|
| results | yes | Report entry form (training context pre-filled) |
| results | no | Report entry form (manual) |
| training | yes | Dashboard with predicted time card |
| training | no | Manual training context form |
| explore | — | Demo report |

---

## Settings Modal Integration

Add a "Strava" section to the existing Privacy tab in `components/SettingsModal.tsx`:

- If connected: show athlete name, connected date, "Disconnect Strava" button
- If not connected: show "Connect Strava" button (links to `/api/strava/connect`)
- Disconnect calls `DELETE /api/strava/connection` with confirmation step

---

## Compliance

| Requirement | Implementation |
|---|---|
| "Connect with Strava" button | Used in `StravaConnectScreen` and Settings |
| Strava orange (#FC5200) on button | Applied in both locations |
| Ocht × Strava attribution | Lockup in onboarding header |
| Delete all data on revocation | `DELETE /api/strava/connection` deletes `StravaProfile` + `StravaConnection` |
| Delete all data on account deletion | Prisma cascade from `User → StravaConnection → StravaProfile` |
| No AI/ML usage | All metrics are pure algorithmic computation — confirmed no LLM calls |
| Strava app review (Standard Tier) | Required before public launch; dev mode limited to 10 athletes |

---

## Out of Scope (v1)

- Strava webhooks (real-time activity push)
- Garmin / Polar / Apple Health integrations
- Displaying raw Strava activity feed in Ocht
- Storing individual raw activities in Ocht DB (only derived metrics stored)
- Social sharing via Strava

---

## File Map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Add `StravaConnection`, `StravaProfile`; add fields to `User` |
| `lib/stravaTokens.ts` | Create — AES-256-GCM encrypt/decrypt, `getValidAccessToken` |
| `lib/stravaTypes.ts` | Create — `StravaAthlete`, `StravaActivity` subset types |
| `lib/stravaClient.ts` | Create — `getAthlete`, `getActivities` |
| `lib/stravaMetrics.ts` | Create — all 5 computation functions |
| `lib/stravaSyncService.ts` | Create — `syncStravaProfile` |
| `app/api/strava/connect/route.ts` | Create |
| `app/api/strava/callback/route.ts` | Create |
| `app/api/strava/status/route.ts` | Create |
| `app/api/strava/sync/route.ts` | Create |
| `app/api/strava/connection/route.ts` | Create (DELETE handler) |
| `components/onboarding/OnboardingModal.tsx` | Create |
| `components/onboarding/GoalScreen.tsx` | Create |
| `components/onboarding/StravaConnectScreen.tsx` | Create |
| `components/SettingsModal.tsx` | Modify — add Strava section to Privacy tab |
| `app/api/auth/me/route.ts` | Modify — accept `onboardingCompleted` in PATCH |
| `styles/_onboarding.scss` | Create — onboarding modal styles |
