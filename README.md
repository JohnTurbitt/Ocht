# Ocht

Ocht is a mobile-first race split analyzer for hybrid athletes. Ocht means eight in Irish, matching the common eight-run/eight-station race structure. The MVP lets an athlete enter run splits and station splits, then uses a deterministic scoring engine to rank weak points, estimate recoverable time, and suggest the next training priorities.

## Tech Stack

- Next.js
- React
- TypeScript
- SCSS
- Prisma
- PostgreSQL

Current analysis:

- HYROX, TRYKA 800, and TRYKA 500 race format presets
- run fade
- pacing volatility
- station benchmark gaps
- recoverability scoring
- top three time leaks
- realistic next target
- four-week deterministic training focus
- sample race onboarding controls
- account profile defaults for target time and athlete level

Backend foundation:

- Prisma schema for users, subscriptions, and race reports
- password hashing helpers
- report persistence mappers that keep the current UI shape separate from the database shape
- Auth routes and sessions
- health check route for deployment monitoring
- clearer API error messages for auth, checkout, and billing failures
- server-backed saved report history
- Stripe checkout route and subscription webhook
- Stripe customer portal for subscription management
- paid report copy, share, download, and print actions
- Ocht premium badge for paid-only report features
- launch trust pages for privacy, terms, refunds, and contact
- calculation methodology page for beta trust and review
- beta feedback links for tester review
- security headers, origin checks, and API rate limits for launch hardening
- Open Graph and Twitter share metadata
- password reset and email verification flows
- account data export (GDPR-style self-service export)
- Strava connection, profile sync, and auto-filled training context
- admin dashboard for searching users and viewing account/report detail
- admin subscription override (grant comp access / disable an account), audited via `AdminAction`

Planned additions:

- race-day pace card
- benchmark bands
- compare two reports
- performance trend dashboard
- manual HR and RPE inputs

## Upcoming Premium Features

Planned premium roadmap, in suggested build order:

1. Race-day pace card
   - Target split for every run and station.
   - Cumulative checkpoint time after each segment.
   - Warning zones where the athlete is most likely to lose the target.
   - One focus cue per key segment.
   - Printable and shareable for race week.

2. Benchmark bands
   - Starter, Competitive, and Elite bands for each run or station.
   - User marker and target marker on the same visual.
   - Clear indication of where the athlete is closest to each level.

3. Compare two reports
   - Select two saved reports and compare total time gained or lost.
   - Show run improvement, station improvement, and segment deltas.
   - Summarize what changed between attempts.

4. Performance trend dashboard
   - Projected finish trend over time.
   - Target gap trend.
   - Average run trend.
   - Biggest leak history.
   - Station leak trend from saved reports.

5. Manual HR and RPE inputs
   - Optional RPE per segment.
   - Optional average or max HR per segment.
   - Segment notes for effort, pacing, or execution.
   - Use the added effort data to explain whether a leak looks like fitness,
     pacing, fatigue, or station execution.

## Paid Report Boundary

Free users can use the built-in HYROX, TRYKA 800, and TRYKA 500 formats and see
the projected finish, run summary, target gap, and the first two ranked leaks.
Paid users unlock the full leak list, custom race builder, saved custom
templates, training priorities, four-week focus, target simulator, station
ranking, print view, and calculation breakdown. Paid users can also copy a
coach-friendly summary, share a report image when the browser supports native
file sharing, download a text report, or print the report.

## Stripe Setup

Add these values to `.env` before testing checkout:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

The checkout endpoint is `POST /api/billing/checkout`. The customer billing
portal endpoint is `POST /api/billing/portal`. Configure Stripe webhooks to
send subscription events to `/api/billing/webhook`.

The deployment health endpoint is `GET /api/health`. It returns `200` when the
app can reach the database and `503` when the database check fails.

Paid customers can unsubscribe through the `Manage billing` button shown in the
signed-in account panel. Stripe handles the cancellation flow, then webhook
events update the local `User.subscription` status.

## Local Stripe Test Flow

Run Ocht:

```bash
npm run dev
```

In a separate terminal, forward Stripe webhooks:

```powershell
& "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe\stripe.exe" listen --forward-to http://127.0.0.1:3002/api/billing/webhook
```

Use the `whsec_...` value printed by the Stripe CLI as
`STRIPE_WEBHOOK_SECRET`, then restart the dev server.

To test checkout:

1. Sign in or create a local Ocht account.
2. Generate a report.
3. Click `Unlock full report`.
4. Use Stripe test card `4242 4242 4242 4242` with any future expiry date
   and any CVC.
5. Keep the webhook listener running so the account is upgraded to paid access
   after checkout completes.

To test cancellation:

1. Sign in as a paid test user.
2. Click `Manage billing` in the top account panel.
3. Cancel the subscription in Stripe's customer portal.
4. Return to Ocht and keep the webhook listener running.
5. Confirm the account panel changes from `Paid access` to the updated
   subscription status and paid report sections lock again.

## Going Live Checklist

Set these production environment variables on the deployment host:

```bash
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://your-domain.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...
```

Before launch:

1. Use live Stripe keys and a live recurring `price_...` value, not a `prod_...`
   product id.
2. Set `NEXT_PUBLIC_APP_URL` to the exact public site origin. Checkout success,
   cancellation, and billing portal return URLs are built from this value.
3. Configure the Stripe webhook endpoint as
   `https://your-domain.com/api/billing/webhook`.
4. Subscribe the webhook to checkout and customer subscription events.
5. Run database migrations against the production database before serving
   traffic.
6. Run `npm run build` in the production environment and confirm it completes.
7. Review `/privacy`, `/terms`, `/refunds`, and `/contact`, including the
   support email address, before public launch.

## Launch Security Checklist

Implemented app-side safeguards:

- hashed passwords with bcrypt
- hashed database session tokens
- `httpOnly`, `sameSite=lax`, production-secure session cookies
- Stripe webhook signature verification
- user-scoped report reads and deletes
- server-side report recalculation before persistence
- browser origin checks on state-changing API routes
- Postgres-backed rate limits for auth, reports, checkout, and billing portal
  (atomic upsert against `RateLimitCounter`, so limits hold across serverless
  instances/invocations instead of resetting per-instance)
- response security headers from `next.config.ts`

Before taking broad public traffic:

1. Keep all production secrets in the deployment provider, not in git.
2. Rotate any key that was pasted into chat, logs, screenshots, or public tools.
3. Use a managed production database with SSL, backups, and a strong password.
4. Configure Stripe live webhooks and monitor failed webhook deliveries.
5. Review the legal pages with appropriate professional advice.
6. Check the public URL in a social share preview tool so the Open Graph title,
   description, and image render as expected.

## Admin

There is no in-app way to grant admin access, by design. Grant or revoke it
with the one-off script, against whichever database your active `.env` points
at:

```bash
npx tsx prisma/set-admin.ts you@example.com          # grant
npx tsx prisma/set-admin.ts you@example.com --revoke  # revoke
```

Admins get an `/admin` dashboard to search users and drill into an account's
report and billing detail, plus a subscription override action (grant comp
access, disable an account, or clear an existing override). Every override is
recorded in the `AdminAction` table (admin, target user, action, reason,
timestamp) for audit history. Admins with existing audit history cannot be
deleted, to keep that history intact.

All `/api/admin/*` routes 404 (not 403) for non-admins, so the endpoints are
indistinguishable from nonexistent ones to anyone who isn't already a verified
admin. Admin gating is checked before rate limiting, so that 404 behavior is
consistent regardless of request volume.

## Strava

Users can connect a Strava account (`/api/strava/connect` → OAuth callback at
`/api/strava/callback`) to auto-fill training context on new reports instead
of entering it by hand. Tokens are stored encrypted (`STRAVA_TOKEN_ENCRYPTION_KEY`);
`/api/strava/sync` refreshes the connection, `/api/strava/status` and
`/api/strava/profile` back the in-app connection UI.

## Getting Started

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env` and fill in a real `DATABASE_URL` (see
[Environment Variables](#environment-variables)).

Run the local dev server:

```bash
npm run dev
```

Open `http://127.0.0.1:3002`.

For preview handoff steps, see [TESTING.md](./TESTING.md).

## Local Dev Seed Accounts

`prisma/seed-dev.ts` seeds four fake accounts into the local dev database with
race report history already filled in, so there's data to browse without
building it up by hand. None of them have a Strava connection — sign up with
your own account separately to test that flow for real.

```bash
npx prisma migrate deploy   # first time only, against a fresh dev database
npx tsx prisma/seed-dev.ts  # safe to re-run; wipes and recreates these 4 accounts
```

| Email | Level | Race format | Reports |
|---|---|---|---|
| `alex.starter@ocht.dev` | Starter | TRYKA 500 | 6, improving trend |
| `jordan.competitive@ocht.dev` | Competitive | HYROX | 6, improving trend |
| `sam.elite@ocht.dev` | Elite | HYROX | 6, improving trend |
| `riley.tryka800@ocht.dev` | Competitive | TRYKA 800 | 6, improving trend |

Password for all four: `OchtDevPass123!`

All seed accounts are on `ACTIVE` subscription so premium report sections
render without needing a real Stripe checkout locally.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server on `127.0.0.1:3002` |
| `npm run build` | Production build (runs `prisma generate` first via `prebuild`) |
| `npm run start` | Serve the production build |
| `npm test` | Run the vitest suite once |
| `npm run test:watch` | Run vitest in watch mode |
| `npm run lint` | Run eslint |
| `npm run prisma:generate` | Regenerate the Prisma client |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:studio` | Open Prisma Studio against the active `DATABASE_URL` |

## Environment Variables

Copy `.env.example` to `.env` and fill in real values. `.env.example` is a
committed template only — nothing reads it directly.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Ocht runs on Neon in dev and prod) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public site origin; used to build checkout/portal/OAuth return URLs |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | No | `true` to enable Vercel Analytics (default `false`) |
| `BETA_SIGNUP_CODE` | No | Gate code for beta signups, if set |
| `STRIPE_SECRET_KEY` | Yes (for billing) | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes (for billing) | Stripe webhook signing secret |
| `STRIPE_PRICE_ID` | Yes (for billing) | Server-side recurring price id |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes (for billing) | Stripe publishable key |
| `NEXT_PUBLIC_STRIPE_PRICE_ID` | Yes (for billing) | Client-side recurring price id |
| `NEXT_PUBLIC_PREMIUM_SELF_SERVE_ENABLED` | No | `true` to show the real checkout/upgrade buttons (default `false` shows a "beta testers only" note instead — grant access manually via `/admin` until live Stripe keys are ready) |
| `RESEND_API_KEY` | Yes (for email) | Resend API key for verification/reset emails |
| `EMAIL_FROM` | Yes (for email) | From address, e.g. `Ocht <support@ocht.app>` |
| `STRAVA_CLIENT_ID` | Yes (for Strava) | Strava OAuth app client id |
| `STRAVA_CLIENT_SECRET` | Yes (for Strava) | Strava OAuth app client secret |
| `STRAVA_TOKEN_ENCRYPTION_KEY` | Yes (for Strava) | 32-byte key to encrypt stored tokens: `openssl rand -base64 32` |

`.env` must be saved as plain UTF-8 (no BOM). Prisma 7 doesn't auto-load
`.env`, so `prisma.config.ts` hand-rolls the reader; a BOM at the start of the
file breaks its regex and the Prisma CLI silently falls back to the
`postgres:postgres@localhost` placeholder, while `next dev` (which strips the
BOM) keeps working. If a Prisma CLI command fails auth but the app doesn't,
check `.env`'s encoding first.

## Product Direction

The first paid feature is the full race analytics report — split diagnosis,
biggest time leaks, realistic next target, station ranking, and four-week
training priorities, unlocked via Stripe. That's shipped; see
[Upcoming Premium Features](#upcoming-premium-features) for what's next.

The app is intentionally web-first. Once the workflow is proven, it can become a PWA or be wrapped with Capacitor for app stores.

## Demo Video

`video/` is a separate Remotion project (its own `package.json`) for
rendering the Ocht demo video/stills. It isn't part of the Next.js app build.

```bash
cd video
npm install
npm run still   # renders out/still.png
npm run render  # renders out/ocht-demo.mp4
```
