# Admin screen — design

## Problem

There's no way to grant a comp/free subscription to a specific user, or to disable a user's subscription access for troubleshooting, without editing the database directly. Two things make this harder than a typical admin CRUD screen:

1. Admin auth needs to be real server-side gating, not a hidden page — this screen mutates other users' billing-adjacent state.
2. `User.subscription` is written unconditionally by the Stripe webhook (`app/api/billing/webhook/route.ts`) on every `checkout.session.completed` / `customer.subscription.*` event. A manually-granted comp subscription must not get silently clobbered back to `FREE` (or worse, a disable-override get silently cleared to `ACTIVE`) the next time Stripe fires a sync event.

## Decisions (from brainstorm)

1. **Override, not overwrite.** A new nullable `subscriptionOverride` field on `User` sits alongside the existing Stripe-driven `subscription` field. Stripe's webhook keeps writing `subscription` exactly as it does today, unconditionally, and never reads or writes `subscriptionOverride`. A single `effectiveSubscription()` helper resolves the two into the value the rest of the app actually gates on.
2. **Audit-logged admin actions.** Every override change writes a row to a new `AdminAction` table (who, whom, what, why, when). Reason is required.
3. **`isAdmin` is DB-only.** No in-app UI ever creates an admin. You flip `isAdmin: true` on a `User` row by hand (Prisma Studio or a one-off script) when needed.
4. **Fail-closed, indistinguishable-from-nonexistent gating.** `/admin` and `/api/admin/*` check admin status before anything else runs. Anyone without a valid admin session — logged out or logged in as a regular user — gets the exact same 404 a nonexistent route would produce. `/admin` is added to `robots.ts`'s disallow list.
5. **Lookup-only UI, not a browse-all table.** Search by email or Stripe customer ID (`cus_...`), pick a result, act on it. No paginated user table, no bulk actions, no profile editing, no user deletion, no admin-granting UI.

## Data model changes

```prisma
enum SubscriptionOverride {
  COMP
  DISABLED
}

enum AdminActionType {
  GRANT_COMP
  DISABLE
  CLEAR_OVERRIDE
}

model User {
  // ...existing fields...
  isAdmin              Boolean               @default(false)
  subscriptionOverride SubscriptionOverride?
  adminActionsTaken    AdminAction[]         @relation("AdminActor")
  adminActionsReceived AdminAction[]         @relation("AdminTarget")
}

model AdminAction {
  id           String          @id @default(cuid())
  adminId      String
  admin        User            @relation("AdminActor", fields: [adminId], references: [id], onDelete: Cascade)
  targetUserId String
  targetUser   User            @relation("AdminTarget", fields: [targetUserId], references: [id], onDelete: Cascade)
  action       AdminActionType
  reason       String
  createdAt    DateTime        @default(now())

  @@index([targetUserId])
  @@index([adminId])
}
```

`isAdmin` defaults `false`. `subscriptionOverride` defaults `null` ("no override, trust Stripe"). Both `AdminAction` relations cascade on user deletion, consistent with the existing pattern for `RaceReport`/`UserSession`/etc. — an admin-action history tied to a deleted account is deleted with it, same as the rest of that account's data.

## Effective subscription resolution

New function in `lib/billing.ts`:

```ts
function effectiveSubscription(user: {
  subscription: SubscriptionStatus;
  subscriptionOverride: SubscriptionOverride | null;
}): SubscriptionStatus {
  if (user.subscriptionOverride === "COMP") return "ACTIVE";
  if (user.subscriptionOverride === "DISABLED") return "FREE";
  return user.subscription;
}
```

`getCurrentUser` (`lib/apiAuth.ts`) selects `subscriptionOverride` alongside `subscription`, computes the effective value, and passes that into `toPublicUser`. This is the single choke point: every existing gating call site that reads `user.subscription` off the public user object — `app/app/page.tsx`, `components/PremiumTierGate.tsx`, `components/OnboardingChecklist.tsx`, `components/SettingsModal.tsx`, `components/AuthPanel.tsx`, `app/settings/page.tsx`, `app/api/billing/checkout/route.ts` — needs **no changes**, because the field they already read reflects the override. The Stripe webhook, checkout route, and portal route continue operating on the real `subscription`/Stripe state exactly as today; only the read path for gating is affected.

## Admin auth gating

A new `requireAdmin` guard in `lib/apiAuth.ts` does its own session lookup, selecting only `{ id, isAdmin }` — independent of the general profile query used by `getCurrentUser`. It is the first thing every `/admin` page render and every `/api/admin/*` handler does:

- `app/admin/page.tsx` (server component): reads the session cookie via `next/headers`, calls `requireAdmin`, calls `notFound()` from `next/navigation` if not an admin.
- `/api/admin/*` route handlers: call the `NextRequest`-based `requireAdmin`, return a plain 404 JSON body (no distinguishing detail) if not an admin.

Not-admin and not-logged-in produce the identical response a truly nonexistent route would. `app/robots.ts`'s `disallow` list gets `/admin` added alongside the existing `/api/`.

The full attack surface: a valid session cookie belonging to a user row with `isAdmin: true`, which only gets set by a direct DB edit. There is no in-app path — UI, API, or otherwise — that creates or reveals an admin.

## Admin API surface

- `GET /api/admin/users?query=` — if `query` starts with `cus_`, exact-matches `stripeCustomerId`; otherwise partial-matches `email`. Returns `id`, `email`, `name`, `subscription`, `stripeCustomerId` for each result.
- `GET /api/admin/users/[id]` — full detail: core account info (email, name, created date, email-verified, onboarding completion), effective subscription *and* raw Stripe `subscription` + current `subscriptionOverride` shown separately, Strava connection status (connected/revoked/connected-at, read-only, no disconnect action), `RaceReport` count and most recent date, and that user's `AdminAction` history (newest first).
- `POST /api/admin/users/[id]/override` — body `{ action: "GRANT_COMP" | "DISABLE" | "CLEAR_OVERRIDE", reason: string }`. 400 if `reason` is blank. Updates `subscriptionOverride` (`GRANT_COMP` → `COMP`, `DISABLE` → `DISABLED`, `CLEAR_OVERRIDE` → `null`) and inserts the corresponding `AdminAction` row in the same transaction.

## Admin UI (`/admin`)

Sidebar-split layout, chosen from three mockups reviewed during brainstorming (email-client/Stripe-dashboard style): a narrow (~260px) left column holds the search input and the result list, always visible; the right column holds the full detail panel for whichever result is selected, with no navigation away from search to see it. Detail panel shows account info, Strava status, report activity, current override state (with the raw Stripe status alongside it, so it's never ambiguous which one is "real"), three action buttons (Grant comp access / Disable access / Clear override) each requiring a reason before submitting, and the action history list below.

## Out of scope for v1

Editing user profile data; deleting users from the admin screen (self-service account deletion already exists separately and is untouched by this work); granting admin rights via any UI; a feature/section-ordering tool (raised during brainstorming, genuinely unrelated to subscription admin — deferred to its own future spec); bulk actions; a paginated browse-all-users table; time-boxed/auto-expiring overrides; notifying a user when their access is changed; IP allowlisting (considered, declined — the isAdmin+404+robots-disallow combination was judged sufficient without the self-lockout risk of a static IP allowlist).

## Testing

`lib/billing.test.ts` (extending the existing test file, or a new one following the same pattern as `lib/session.test.ts`) covers `effectiveSubscription()` directly — pure function, no DB or jsdom needed: `COMP` → `ACTIVE` regardless of underlying `subscription`, `DISABLED` → `FREE` regardless of underlying `subscription`, `null` → passthrough of the underlying `subscription` value for all four `SubscriptionStatus` values. The `requireAdmin` guard and the `/api/admin/*` route handlers are integration-shaped (session + DB), consistent with how `lib/apiAuth.ts`'s existing `getCurrentUser`/`requireCurrentUser` are exercised elsewhere in this codebase — the implementation plan should follow whatever precedent those use today rather than introducing a new test style.
