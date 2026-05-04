# RepRun

RepRun is a mobile-first race split analyzer for hybrid athletes. The MVP lets an athlete enter eight run splits and eight station splits, then uses a deterministic scoring engine to rank weak points, estimate recoverable time, and suggest the next training priorities.

## Tech Stack

- Next.js
- React
- TypeScript
- SCSS
- Prisma
- PostgreSQL

Current analysis:

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
- server-backed saved report history
- Stripe checkout route and subscription webhook
- Stripe customer portal for subscription management
- paid report copy, share, download, and print actions
- RepRun premium badge for paid-only report features
- launch trust pages for privacy, terms, refunds, and contact

Planned additions:

- richer report history

## Paid Report Boundary

Free users see the projected finish, run summary, target gap, and the first two
ranked leaks. Paid users unlock the full leak list, training priorities,
four-week focus, target simulator, station ranking, print view, and calculation
breakdown. Paid users can also copy a coach-friendly summary, share a report
image when the browser supports native file sharing, download a text report, or
print the report.

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

Paid customers can unsubscribe through the `Manage billing` button shown in the
signed-in account panel. Stripe handles the cancellation flow, then webhook
events update the local `User.subscription` status.

## Local Stripe Test Flow

Run RepRun:

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

1. Sign in or create a local RepRun account.
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
4. Return to RepRun and keep the webhook listener running.
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
