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
- basic in-memory rate limits for auth, reports, checkout, and billing portal
- response security headers from `next.config.ts`

Before taking broad public traffic:

1. Keep all production secrets in the deployment provider, not in git.
2. Rotate any key that was pasted into chat, logs, screenshots, or public tools.
3. Use a managed production database with SSL, backups, and a strong password.
4. Configure Stripe live webhooks and monitor failed webhook deliveries.
5. Consider hosted rate limiting such as Upstash, Redis, Vercel Firewall, or
   Cloudflare before scaling beyond a small beta. In-memory rate limits reset
   when serverless instances restart and do not coordinate across instances.
6. Add password reset and email verification before a larger paid launch.
7. Review the legal pages with appropriate professional advice.
8. Check the public URL in a social share preview tool so the Open Graph title,
   description, and image render as expected.

## Getting Started

Install dependencies:

```bash
npm install
```

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

```bash
npm run dev
npm run build
npm run start
npm run test
npm run prisma:generate
npm run prisma:migrate
```

## Product Direction

The first paid feature should be a full race analytics report:

- split diagnosis
- biggest time leaks
- realistic next target
- station ranking
- four-week training priorities
- unlockable full report via Stripe

The app is intentionally web-first. Once the workflow is proven, it can become a PWA or be wrapped with Capacitor for app stores.
