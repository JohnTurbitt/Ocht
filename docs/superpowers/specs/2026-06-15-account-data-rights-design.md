# Account & Data Rights — Design Spec

**Status:** Approved
**Date:** 2026-06-15

## Goal

Give users self-service control over their account and the data Ocht holds
about them, and make the existing cookie banner actually do something:

1. **Account deletion** — permanently delete an account (and cancel any
   active Stripe subscription) from the account menu.
2. **Data export** — download a JSON copy of your profile and saved reports.
3. **Cookie consent gating** — the cookie banner's Accept/Decline choice
   actually controls whether Vercel Analytics and the app's custom
   `trackEvent` calls run, and users can change their choice later via a
   footer link.

This is sub-project 3 of 4 in the "Beta → Production" hardening work (the
others — error visibility, API abuse protection, billing resilience — are
separate specs).

## Architecture

Three mostly-independent pieces, all reachable from `AuthPanel`'s account
menu (where "Profile settings" already lives) plus a footer link for cookie
preferences:

- `app/api/auth/me/route.ts` gains a `DELETE` handler.
- A new `app/api/auth/me/export/route.ts` adds a `GET` handler.
- A new `lib/cookieConsent.ts` module centralizes consent state (read/write/
  reset + a change event), used by `CookieBanner`, a new
  `ConsentedAnalytics` wrapper around `<Analytics />`, and `lib/analytics.ts`.

## Components

### A. Account deletion

**`app/api/auth/me/route.ts` — new `DELETE` export**

```ts
export async function DELETE(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "account-delete",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const currentUser = await requireCurrentUser(request);

  if (!currentUser) {
    return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
  }

  try {
    const databaseUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { stripeCustomerId: true },
    });

    if (databaseUser?.stripeCustomerId) {
      try {
        const subscriptions = await getStripe().subscriptions.list({
          customer: databaseUser.stripeCustomerId,
          status: "all",
        });

        await Promise.all(
          subscriptions.data
            .filter((subscription) => subscription.status !== "canceled")
            .map((subscription) => getStripe().subscriptions.cancel(subscription.id)),
        );
      } catch (error) {
        logServerError(
          "Stripe subscription cancellation failed during account deletion",
          error,
        );
      }
    }

    await prisma.user.delete({ where: { id: currentUser.id } });

    const response = NextResponse.json({ ok: true });

    response.cookies.delete(sessionCookieName);

    return response;
  } catch (error) {
    logServerError("Account deletion failed", error);

    return NextResponse.json(
      { errors: ["Your account could not be deleted."] },
      { status: 500 },
    );
  }
}
```

New imports needed in this file: `requireCurrentUser` (from `@/lib/apiAuth`),
`getStripe` (from `@/lib/billing`), `logServerError` (from `@/lib/logging`),
`sessionCookieName` (from `@/lib/session`).

Stripe subscription cancellation is **best-effort**: a Stripe failure is
logged but does not block `prisma.user.delete`, since the cascading deletes
(`onDelete: Cascade` on `UserSession`, `PasswordResetToken`,
`EmailVerificationToken`, `RaceReport`) are the part that fulfils the
erasure request and shouldn't depend on a third-party API being up.

**`lib/apiClient.ts` — new function**

```ts
export async function deleteAccount() {
  const response = await fetch("/api/auth/me", { method: "DELETE" });

  await readApiResponse<{ ok: true }>(response);
}
```

**`components/AuthPanel.tsx`**

- New prop: `onDeleteAccount: () => Promise<void>`.
- New state: `deleteConfirmOpen` (boolean), `deleting` (boolean, for button
  loading state — separate from `submitting` since profile save and account
  deletion shouldn't share a spinner flag).
- In the signed-in account menu, after "Profile settings" and the new
  "Download my data" link (Section B), add:
  - If `!deleteConfirmOpen`: a button "Delete account" with class
    `button-danger auth-panel__menu-item`, `onClick={() =>
    setDeleteConfirmOpen(true)}`.
  - If `deleteConfirmOpen`: a warning block —
    "This permanently deletes your account, saved reports, and cancels any
    subscription. This can't be undone." — with two buttons: "Cancel"
    (`onClick={() => setDeleteConfirmOpen(false)}`) and "Yes, delete my
    account" (`button-danger`, calls `onDeleteAccount()`, shows a spinner via
    `deleting` while in flight).

**`app/page.tsx` — new handler**

```ts
async function handleDeleteAccount() {
  try {
    await deleteAccount();
    setUser(null);
    setSavedReports(loadSavedReports());
    setToast({
      id: Date.now(),
      title: "Account deleted",
      message: "Your Ocht account and saved reports have been removed.",
      tone: "success",
    });
    trackEvent("account_deleted");
  } catch (error) {
    setToast({
      id: Date.now(),
      title: "Account not deleted",
      message:
        error instanceof Error ? error.message : "Ocht could not delete your account.",
      tone: "error",
    });
    throw error;
  }
}
```

Pass `onDeleteAccount={handleDeleteAccount}` to `<AuthPanel />`. This mirrors
`handleLogout`/`handleSaveProfile` exactly — `setUser(null)` plus
`setSavedReports(loadSavedReports())` returns the UI to the same
signed-out/local-storage state as logout.

### B. GDPR data export

**New file: `app/api/auth/me/export/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { toPublicUser } from "@/lib/profile";
import { toSavedReport } from "@/lib/reportPersistence";

export async function GET(request: NextRequest) {
  const user = await requireCurrentUser(request);

  if (!user) {
    return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
  }

  try {
    const [databaseUser, reports] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          name: true,
          subscription: true,
          defaultLevel: true,
          defaultTargetTime: true,
          createdAt: true,
        },
      }),
      prisma.raceReport.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!databaseUser) {
      return NextResponse.json({ errors: ["Account not found."] }, { status: 404 });
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      account: toPublicUser(databaseUser),
      reports: reports.map((report) => toSavedReport(report)),
    };

    return NextResponse.json(exportPayload, {
      headers: {
        "Content-Disposition": 'attachment; filename="ocht-data-export.json"',
      },
    });
  } catch (error) {
    logServerError("Account data export failed", error);

    return NextResponse.json(
      { errors: ["Your data export could not be generated."] },
      { status: 500 },
    );
  }
}
```

`reports.map((report) => toSavedReport(report))` follows the exact same
mapping `GET /api/reports` already uses — `toSavedReport` accepts the Prisma
`RaceReport` row shape directly (its `PersistedReportSummary` type matches).

No rate-limit guard, matching `GET /api/reports` and `GET /api/auth/me`,
which rely on the session cookie alone.

**UI** (`AuthPanel.tsx`, account menu): a plain link —

```tsx
<a
  className="button-secondary auth-panel__menu-item"
  href="/api/auth/me/export"
>
  Download my data
</a>
```

placed between "Profile settings" and "Delete account". The
`Content-Disposition: attachment` header makes the browser download the file
directly; no client-side fetch/blob handling is needed.

### C. Cookie consent gating analytics

**New file: `lib/cookieConsent.ts`**

```ts
"use client";

export const COOKIE_CONSENT_KEY = "ocht.cookieConsent";
export const COOKIE_CONSENT_CHANGE_EVENT = "ocht:cookie-consent-change";

export type CookieConsent = "accepted" | "declined" | null;

export function getCookieConsent(): CookieConsent {
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);

    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(choice: "accepted" | "declined") {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  } catch {
    // Ignore storage failures (e.g. privacy mode) — consent simply won't persist.
  }

  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

export function resetCookieConsent() {
  try {
    window.localStorage.removeItem(COOKIE_CONSENT_KEY);
  } catch {
    // Ignore storage failures.
  }

  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

export function hasAnalyticsConsent() {
  return getCookieConsent() === "accepted";
}
```

**`components/CookieBanner.tsx`** — replace the inline `consentKey`/
`localStorage` calls with `getCookieConsent`/`setCookieConsent` from
`lib/cookieConsent.ts`, and add an effect that listens for
`COOKIE_CONSENT_CHANGE_EVENT`: if the consent value becomes `null` (i.e.
`resetCookieConsent()` was called from the footer), set `visible(true)` again
so the banner reappears.

**New file: `components/ConsentedAnalytics.tsx`**

```tsx
"use client";

import { Analytics } from "@vercel/analytics/next";
import { useEffect, useState } from "react";
import { COOKIE_CONSENT_CHANGE_EVENT, hasAnalyticsConsent } from "@/lib/cookieConsent";

export function ConsentedAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const update = () => setConsented(hasAnalyticsConsent());

    update();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, update);

    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, update);
  }, []);

  if (!consented) {
    return null;
  }

  return <Analytics />;
}
```

**`app/layout.tsx`** — replace:

```tsx
import { Analytics } from "@vercel/analytics/next";
// ...
<Analytics />
```

with:

```tsx
import { ConsentedAnalytics } from "@/components/ConsentedAnalytics";
// ...
<ConsentedAnalytics />
```

**`lib/analytics.ts`** — gate `trackEvent`:

```ts
import { hasAnalyticsConsent } from "./cookieConsent";

export function trackEvent(name: string, properties: AnalyticsProperties = {}) {
  if (!enabled || !hasAnalyticsConsent()) {
    return;
  }

  track(name, properties);
}
```

**`components/SiteFooter.tsx`** — add a "Cookie preferences" button to the
nav, calling `resetCookieConsent()`:

```tsx
<button
  type="button"
  className="site-footer__link"
  onClick={() => resetCookieConsent()}
>
  Cookie preferences
</button>
```

(`site-footer__link` is a new style making a `<button>` look like the
adjacent `<Link>`/`<a>` nav items.)

**`styles/_auth.scss`** — add a `.button-danger` variant alongside the
existing `.button-secondary` for the destructive delete-account buttons.

**`app/privacy/page.tsx`** — update the "Retention And Deletion" section to
read:

```
Account and report data is retained while your account exists. You can
download a copy of your data or permanently delete your account at any time
from the account menu. Deleting your account also cancels any active
subscription.
```

and add a sentence to "Third Parties"/analytics copy noting that analytics
only runs after you accept the cookie banner.

## Data Flow

**Deletion:** Account menu → "Delete account" → inline confirm → "Yes,
delete my account" → `DELETE /api/auth/me` → best-effort Stripe subscription
cancellation → `prisma.user.delete` (cascades) → session cookie cleared →
`{ ok: true }` → client clears `user` state and shows a success toast.

**Export:** Account menu → "Download my data" → browser navigates to
`GET /api/auth/me/export` → server builds `{ exportedAt, account, reports }`
→ `Content-Disposition: attachment` triggers a file download of
`ocht-data-export.json`.

**Cookie consent:** On first visit, `CookieBanner` shows (no stored choice).
Accept/Decline calls `setCookieConsent`, which persists the choice and fires
`COOKIE_CONSENT_CHANGE_EVENT`. `ConsentedAnalytics` and `trackEvent` both
check `hasAnalyticsConsent()` — only `"accepted"` enables Vercel Analytics
and custom events. The footer's "Cookie preferences" button calls
`resetCookieConsent()`, which fires the same event; `CookieBanner` reacts by
showing itself again, and `ConsentedAnalytics` reacts by unmounting
`<Analytics />` if consent is no longer `"accepted"`.

## Error Handling

- `DELETE /api/auth/me`: 401 if not signed in, 403/429 from
  `guardBrowserMutation` (origin check / rate limit), 500 with a generic
  message on unexpected DB errors. Stripe cancellation failures are logged
  but do not turn into a user-facing error — deletion still proceeds.
- `GET /api/auth/me/export`: 401 if not signed in, 404 if the user row is
  somehow missing (deleted between auth check and query), 500 on DB errors.
- Cookie consent helpers wrap all `localStorage` access in try/catch (same
  pattern the existing `CookieBanner` already uses) so consent simply
  doesn't persist in privacy modes rather than throwing.

## Testing

- `app/api/auth/me/route.test.ts` (new) — `DELETE`: requires auth (401),
  rate-limited (mock `guardBrowserMutation`'s underlying rate limiter or call
  past the limit), cancels Stripe subscriptions when `stripeCustomerId` is
  set (mock `@/lib/billing`'s `getStripe`), proceeds with deletion even if
  Stripe cancellation throws, deletes the user row, clears the session
  cookie.
- `app/api/auth/me/export/route.test.ts` (new) — requires auth (401), returns
  the expected `{ exportedAt, account, reports }` shape with
  `Content-Disposition` header set, excludes `passwordHash`/
  `stripeCustomerId`.
- `lib/cookieConsent.test.ts` (new) — `getCookieConsent`/`setCookieConsent`/
  `resetCookieConsent` round-trip through `localStorage` and dispatch
  `COOKIE_CONSENT_CHANGE_EVENT`; `hasAnalyticsConsent` is `true` only when
  `"accepted"`.
- `lib/analytics.test.ts` (new) — `trackEvent` is a no-op when
  `hasAnalyticsConsent()` is `false`, and calls `track` when `true` and
  `enabled`.

## File Structure Summary

| File | Change |
|---|---|
| `app/api/auth/me/route.ts` | Add `DELETE` handler (account deletion + Stripe cancel) |
| `app/api/auth/me/route.test.ts` | New tests for `DELETE` |
| `app/api/auth/me/export/route.ts` | New `GET` handler (data export) |
| `app/api/auth/me/export/route.test.ts` | New tests |
| `lib/apiClient.ts` | Add `deleteAccount()` |
| `lib/cookieConsent.ts` | New module (consent get/set/reset + event) |
| `lib/cookieConsent.test.ts` | New tests |
| `lib/analytics.ts` | Gate `trackEvent` on `hasAnalyticsConsent()` |
| `lib/analytics.test.ts` | New tests |
| `components/AuthPanel.tsx` | Add delete-account confirm UI + export link |
| `components/CookieBanner.tsx` | Use shared consent helpers; re-show on reset |
| `components/ConsentedAnalytics.tsx` | New wrapper around `<Analytics />` |
| `components/SiteFooter.tsx` | Add "Cookie preferences" button |
| `app/layout.tsx` | Swap `<Analytics />` for `<ConsentedAnalytics />` |
| `app/page.tsx` | Add `handleDeleteAccount` |
| `app/privacy/page.tsx` | Update retention/deletion + analytics copy |
| `styles/_auth.scss` | Add `.button-danger` variant |
