# Account & Data Rights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete their account (with Stripe subscription cancellation), download a JSON export of their account and reports, and make the cookie banner's Accept/Decline choice actually gate Vercel Analytics and `trackEvent` calls.

**Architecture:** A new `lib/cookieConsent.ts` module centralizes consent state behind `getCookieConsent`/`setCookieConsent`/`resetCookieConsent`/`hasAnalyticsConsent` plus a `COOKIE_CONSENT_CHANGE_EVENT`; `CookieBanner`, a new `ConsentedAnalytics` wrapper, and `lib/analytics.ts` all read from it. `app/api/auth/me/route.ts` gains a `DELETE` handler (Stripe cancellation + cascading Prisma delete), and a new `app/api/auth/me/export/route.ts` adds a `GET` handler that reuses `toPublicUser`/`toSavedReport`. `AuthPanel`'s account menu gets a "Download my data" link and an inline delete-account confirmation.

**Tech Stack:** Next.js App Router API routes, Prisma, Stripe SDK, Vitest, SCSS.

---

## Task 1: Cookie consent module

**Files:**
- Create: `lib/cookieConsent.ts`
- Test: `lib/cookieConsent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  getCookieConsent,
  hasAnalyticsConsent,
  resetCookieConsent,
  setCookieConsent,
} from "./cookieConsent";

function makeWindowStub() {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<(event: Event) => void>>();

  return {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
    addEventListener: (type: string, listener: (event: Event) => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, listener: (event: Event) => void) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("window", makeWindowStub());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cookie consent", () => {
  it("defaults to null when nothing is saved", () => {
    expect(getCookieConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("round-trips an accepted choice and reports analytics consent", () => {
    setCookieConsent("accepted");

    expect(getCookieConsent()).toBe("accepted");
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("round-trips a declined choice without analytics consent", () => {
    setCookieConsent("declined");

    expect(getCookieConsent()).toBe("declined");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("dispatches a change event when consent is set", () => {
    const listener = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);

    setCookieConsent("accepted");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears consent and dispatches a change event on reset", () => {
    setCookieConsent("accepted");

    const listener = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);

    resetCookieConsent();

    expect(getCookieConsent()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/cookieConsent.test.ts`
Expected: FAIL with "Cannot find module './cookieConsent'" (or similar resolution error), since `lib/cookieConsent.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
"use client";

export const COOKIE_CONSENT_KEY = "ocht.cookieConsent";
export const COOKIE_CONSENT_CHANGE_EVENT = "ocht:cookie-consent-change";

export type CookieConsent = "accepted" | "declined" | null;

export function getCookieConsent(): CookieConsent {
  const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);

  return value === "accepted" || value === "declined" ? value : null;
}

export function setCookieConsent(choice: "accepted" | "declined") {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

export function resetCookieConsent() {
  window.localStorage.removeItem(COOKIE_CONSENT_KEY);
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

export function hasAnalyticsConsent() {
  return getCookieConsent() === "accepted";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/cookieConsent.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/cookieConsent.ts lib/cookieConsent.test.ts
git commit -m "Add cookie consent module with change event"
```

---

## Task 2: Gate `trackEvent` on analytics consent

**Files:**
- Modify: `lib/analytics.ts`
- Test: `lib/analytics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackMock = vi.fn();
const hasAnalyticsConsentMock = vi.fn();

vi.mock("@vercel/analytics", () => ({
  track: trackMock,
}));

vi.mock("./cookieConsent", () => ({
  hasAnalyticsConsent: hasAnalyticsConsentMock,
}));

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
});

import { trackEvent } from "./analytics";

beforeEach(() => {
  trackMock.mockClear();
  hasAnalyticsConsentMock.mockReset();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
});

describe("trackEvent", () => {
  it("does not call track when analytics consent has not been granted", () => {
    hasAnalyticsConsentMock.mockReturnValue(false);

    trackEvent("report_generated");

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("calls track when enabled and consent has been granted", () => {
    hasAnalyticsConsentMock.mockReturnValue(true);

    trackEvent("report_generated", { source: "test" });

    expect(trackMock).toHaveBeenCalledWith("report_generated", { source: "test" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/analytics.test.ts`
Expected: FAIL — the second test ("calls track when enabled and consent has been granted") fails because `trackEvent` does not yet check `hasAnalyticsConsent()`, so `track` is never called even when consent is granted. Confirm at least one assertion fails before continuing.

- [ ] **Step 3: Write the implementation**

```ts
"use client";

import { track } from "@vercel/analytics";
import { hasAnalyticsConsent } from "./cookieConsent";

type AnalyticsValue = string | number | boolean | null;
type AnalyticsProperties = Record<string, AnalyticsValue>;

const enabled =
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" ||
  process.env.NODE_ENV === "production";

export function trackEvent(name: string, properties: AnalyticsProperties = {}) {
  if (!enabled || !hasAnalyticsConsent()) {
    return;
  }

  track(name, properties);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/analytics.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/analytics.ts lib/analytics.test.ts
git commit -m "Gate trackEvent on cookie analytics consent"
```

---

## Task 3: Consent-gated Vercel Analytics and cookie banner re-show

**Files:**
- Create: `components/ConsentedAnalytics.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/CookieBanner.tsx`

This task has no new automated tests — the project has no component-level (`.test.tsx`) tests, matching the existing convention (only `lib/` and `app/api/` have Vitest coverage). Verify manually in Step 4.

- [ ] **Step 1: Create `components/ConsentedAnalytics.tsx`**

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

- [ ] **Step 2: Wire `ConsentedAnalytics` into `app/layout.tsx`**

In `app/layout.tsx`, replace the `Analytics` import on line 2:

```tsx
import { Analytics } from "@vercel/analytics/next";
```

with:

```tsx
import { ConsentedAnalytics } from "@/components/ConsentedAnalytics";
```

Then replace the `<Analytics />` usage on line 109:

```tsx
        <Analytics />
```

with:

```tsx
        <ConsentedAnalytics />
```

- [ ] **Step 3: Update `components/CookieBanner.tsx` to use the shared consent module and re-show on reset**

Replace the entire contents of `components/CookieBanner.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  getCookieConsent,
  setCookieConsent,
} from "@/lib/cookieConsent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function checkConsent() {
      setVisible(getCookieConsent() === null);
    }

    checkConsent();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, checkConsent);

    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, checkConsent);
  }, []);

  function resolve(choice: "accepted" | "declined") {
    setCookieConsent(choice);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie notice">
      <div className="cookie-banner__body">
        <strong>Cookies &amp; analytics</strong>
        <p>
          Ocht uses local storage to remember your settings and privacy-friendly
          analytics to improve the app. See our{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </div>
      <div className="cookie-banner__actions">
        <button
          className="btn btn--secondary btn--sm"
          type="button"
          onClick={() => resolve("declined")}
        >
          Decline
        </button>
        <button
          className="btn btn--primary btn--sm"
          type="button"
          onClick={() => resolve("accepted")}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manually verify in the dev server**

Run: `npm run dev`

In a browser at `http://127.0.0.1:3002`:
1. Open DevTools → Application → Local Storage and remove any `ocht.cookieConsent` key, then reload. The cookie banner should appear.
2. Click "Accept". The banner should disappear, and `localStorage.getItem("ocht.cookieConsent")` should be `"accepted"`.
3. Reload — the banner should stay hidden.

Stop the dev server after verifying (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add components/ConsentedAnalytics.tsx app/layout.tsx components/CookieBanner.tsx
git commit -m "Gate Vercel Analytics on cookie consent"
```

---

## Task 4: Footer "Cookie preferences" link

**Files:**
- Modify: `components/SiteFooter.tsx`
- Modify: `styles/_layout.scss:1128-1131`

- [ ] **Step 1: Add the "Cookie preferences" button to `components/SiteFooter.tsx`**

Replace the entire contents of `components/SiteFooter.tsx`:

```tsx
import Link from "next/link";
import { resetCookieConsent } from "@/lib/cookieConsent";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>Ocht</strong>
        <span>Hybrid race split analytics.</span>
      </div>
      <nav aria-label="Trust and legal links">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/calculations">Calculations</Link>
        <Link href="/refunds">Refunds</Link>
        <Link href="/contact">Contact</Link>
        <a href="mailto:support@ocht.app?subject=Ocht%20beta%20feedback">
          Feedback
        </a>
        <button
          type="button"
          className="site-footer__link"
          onClick={() => resetCookieConsent()}
        >
          Cookie preferences
        </button>
      </nav>
    </footer>
  );
}
```

- [ ] **Step 2: Add `.site-footer__link` styling to `styles/_layout.scss`**

In `styles/_layout.scss`, the footer link styles currently end with:

```scss
.site-footer a:hover,
.legal-page a:hover {
  text-decoration: underline;
}
```

(lines 1128-1131). Add a new rule immediately after it:

```scss
.site-footer a:hover,
.legal-page a:hover {
  text-decoration: underline;
}

.site-footer__link {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--teal);
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.site-footer__link:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`

In a browser at `http://127.0.0.1:3002`, scroll to the footer and confirm "Cookie preferences" renders inline with the other links/styling. Click it after dismissing the cookie banner — the banner should reappear (re-using the behavior from Task 3).

Stop the dev server after verifying (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add components/SiteFooter.tsx styles/_layout.scss
git commit -m "Add cookie preferences link to site footer"
```

---

## Task 5: Account deletion endpoint

**Files:**
- Modify: `app/api/auth/me/route.ts`
- Test: `app/api/auth/me/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/api/auth/me/route.test.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCurrentUser } from "@/lib/apiAuth";
import { getStripe } from "@/lib/billing";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { sessionCookieName } from "@/lib/session";
import { DELETE } from "./route";

vi.mock("@/lib/apiAuth", () => ({
  getCurrentUser: vi.fn(),
  requireCurrentUser: vi.fn(),
}));

vi.mock("@/lib/billing", () => ({
  getStripe: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  logServerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/security", () => ({
  guardBrowserMutation: vi.fn(() => null),
}));

function deleteRequest() {
  return new NextRequest("http://localhost/api/auth/me", { method: "DELETE" });
}

const testUser = {
  id: "user_1",
  email: "runner@example.com",
  emailVerified: true,
  name: "Test Runner",
  subscription: "ACTIVE" as const,
  defaultLevel: "competitive" as const,
  defaultTargetTime: "1:25:00",
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.mocked(guardBrowserMutation).mockReturnValue(null);
  vi.mocked(requireCurrentUser).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.delete).mockReset();
  vi.mocked(getStripe).mockReset();
  vi.mocked(logServerError).mockClear();
});

describe("DELETE /api/auth/me", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(null);

    const response = await DELETE(deleteRequest());

    expect(response.status).toBe(401);
  });

  it("returns the guard response when rate limited", async () => {
    const guardResponse = NextResponse.json(
      { errors: ["Too many requests."] },
      { status: 429 },
    );
    vi.mocked(guardBrowserMutation).mockReturnValue(guardResponse);

    const response = await DELETE(deleteRequest());

    expect(response).toBe(guardResponse);
    expect(requireCurrentUser).not.toHaveBeenCalled();
  });

  it("cancels active Stripe subscriptions and deletes the account", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_123",
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

    const cancel = vi.fn().mockResolvedValue({});
    const list = vi.fn().mockResolvedValue({
      data: [
        { id: "sub_active", status: "active" },
        { id: "sub_canceled", status: "canceled" },
      ],
    });
    vi.mocked(getStripe).mockReturnValue({
      subscriptions: { list, cancel },
    } as never);

    const response = await DELETE(deleteRequest());

    expect(cancel).toHaveBeenCalledWith("sub_active");
    expect(cancel).not.toHaveBeenCalledWith("sub_canceled");
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: testUser.id } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.cookies.get(sessionCookieName)?.value).toBe("");
  });

  it("deletes the account without calling Stripe when no customer id is set", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: null,
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

    const response = await DELETE(deleteRequest());

    expect(getStripe).not.toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: testUser.id } });
    expect(response.status).toBe(200);
  });

  it("still deletes the account when Stripe cancellation fails", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_123",
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never);
    vi.mocked(getStripe).mockReturnValue({
      subscriptions: {
        list: vi.fn().mockRejectedValue(new Error("Stripe is down")),
        cancel: vi.fn(),
      },
    } as never);

    const response = await DELETE(deleteRequest());

    expect(logServerError).toHaveBeenCalledWith(
      "Stripe subscription cancellation failed during account deletion",
      expect.any(Error),
    );
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: testUser.id } });
    expect(response.status).toBe(200);
  });

  it("returns 500 when the account cannot be deleted", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: null,
    } as never);
    vi.mocked(prisma.user.delete).mockRejectedValue(new Error("DB is down"));

    const response = await DELETE(deleteRequest());

    expect(response.status).toBe(500);
    expect(logServerError).toHaveBeenCalledWith(
      "Account deletion failed",
      expect.any(Error),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/auth/me/route.test.ts`
Expected: FAIL with "DELETE is not exported" (or `DELETE is not a function`), since `app/api/auth/me/route.ts` does not yet export `DELETE`.

- [ ] **Step 3: Add the `DELETE` handler to `app/api/auth/me/route.ts`**

Replace the import block at the top of `app/api/auth/me/route.ts` (lines 1-6):

```ts
import { NextRequest, NextResponse } from "next/server";
import { validateProfilePayload } from "@/lib/apiValidation";
import { getCurrentUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { athleteLevelByLevel, toPublicUser } from "@/lib/profile";
import { guardBrowserMutation } from "@/lib/security";
```

with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { validateProfilePayload } from "@/lib/apiValidation";
import { getCurrentUser, requireCurrentUser } from "@/lib/apiAuth";
import { getStripe } from "@/lib/billing";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { athleteLevelByLevel, toPublicUser } from "@/lib/profile";
import { guardBrowserMutation } from "@/lib/security";
import { sessionCookieName } from "@/lib/session";
```

Then append this `DELETE` export at the end of the file (after the closing brace of `PATCH`, currently line 57):

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/auth/me/route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/me/route.ts app/api/auth/me/route.test.ts
git commit -m "Add account deletion endpoint with Stripe cancellation"
```

---

## Task 6: GDPR data export endpoint

**Files:**
- Create: `app/api/auth/me/export/route.ts`
- Test: `app/api/auth/me/export/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/api/auth/me/export/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

vi.mock("@/lib/apiAuth", () => ({
  getCurrentUser: vi.fn(),
  requireCurrentUser: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  logServerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    raceReport: { findMany: vi.fn() },
  },
}));

function exportRequest() {
  return new NextRequest("http://localhost/api/auth/me/export");
}

const testUser = {
  id: "user_1",
  email: "runner@example.com",
  emailVerified: true,
  name: "Test Runner",
  subscription: "ACTIVE" as const,
  defaultLevel: "competitive" as const,
  defaultTargetTime: "1:25:00",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const databaseUser = {
  id: "user_1",
  email: "runner@example.com",
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  name: "Test Runner",
  subscription: "ACTIVE" as const,
  defaultLevel: "COMPETITIVE" as const,
  defaultTargetTime: "1:25:00",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const databaseReport = {
  id: "report_1",
  goal: "Sub 1:25",
  targetTime: "1:25:00",
  athleteLevel: "COMPETITIVE" as const,
  runSplits: ["8:00", "8:10"],
  stationSplits: { ski: "4:00" },
  trainingContext: null,
  finishSeconds: 5100,
  predictedTargetSeconds: 5000,
  topLeakLabel: "ski",
  analysisSnapshot: { raceFormat: "hyrox" },
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.mocked(requireCurrentUser).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.raceReport.findMany).mockReset();
  vi.mocked(logServerError).mockClear();
});

describe("GET /api/auth/me/export", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(null);

    const response = await GET(exportRequest());

    expect(response.status).toBe(401);
  });

  it("returns the account and reports as a downloadable JSON payload", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(databaseUser as never);
    vi.mocked(prisma.raceReport.findMany).mockResolvedValue([databaseReport] as never);

    const response = await GET(exportRequest());
    const body = await response.json();

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="ocht-data-export.json"',
    );
    expect(body.account).toMatchObject({
      id: "user_1",
      email: "runner@example.com",
      subscription: "ACTIVE",
    });
    expect(body.account.passwordHash).toBeUndefined();
    expect(body.account.stripeCustomerId).toBeUndefined();
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toMatchObject({
      id: "report_1",
      goal: "Sub 1:25",
      level: "competitive",
    });
    expect(typeof body.exportedAt).toBe("string");
  });

  it("returns 404 when the account no longer exists", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.raceReport.findMany).mockResolvedValue([] as never);

    const response = await GET(exportRequest());

    expect(response.status).toBe(404);
  });

  it("returns 500 when the export cannot be generated", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB is down"));
    vi.mocked(prisma.raceReport.findMany).mockResolvedValue([] as never);

    const response = await GET(exportRequest());

    expect(response.status).toBe(500);
    expect(logServerError).toHaveBeenCalledWith(
      "Account data export failed",
      expect.any(Error),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/auth/me/export/route.test.ts`
Expected: FAIL — `app/api/auth/me/export/route.ts` does not exist yet, so the import of `GET` fails to resolve.

- [ ] **Step 3: Create `app/api/auth/me/export/route.ts`**

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/auth/me/export/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/me/export/route.ts app/api/auth/me/export/route.test.ts
git commit -m "Add GDPR data export endpoint"
```

---

## Task 7: Account menu UI for deletion and export

**Files:**
- Modify: `lib/apiClient.ts:181-185`
- Modify: `components/AuthPanel.tsx`
- Modify: `styles/_auth.scss:517-519`
- Modify: `app/page.tsx`

No new automated tests — this task wires existing, already-tested API routes (Task 5, 6) into the UI. Verify manually in Step 5, matching the existing convention that components/pages are not unit-tested.

- [ ] **Step 1: Add `deleteAccount` to `lib/apiClient.ts`**

In `lib/apiClient.ts`, immediately after `deleteRemoteReport` (lines 181-185):

```ts
export async function deleteRemoteReport(reportId: string) {
  const response = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });

  await readApiResponse<{ ok: true }>(response);
}
```

add:

```ts

export async function deleteAccount() {
  const response = await fetch("/api/auth/me", { method: "DELETE" });

  await readApiResponse<{ ok: true }>(response);
}
```

- [ ] **Step 2: Add `onDeleteAccount` prop, state, and account-menu UI to `components/AuthPanel.tsx`**

In the `AuthPanelProps` type, after `onSaveProfile: (input: ProfileFormInput) => Promise<void>;` (line 35):

```ts
  onSaveProfile: (input: ProfileFormInput) => Promise<void>;
```

add:

```ts
  onSaveProfile: (input: ProfileFormInput) => Promise<void>;
  onDeleteAccount: () => Promise<void>;
```

In the `AuthPanel` function parameters, after `onSaveProfile,` (line 63):

```ts
  onSaveProfile,
}: AuthPanelProps) {
```

add:

```ts
  onSaveProfile,
  onDeleteAccount,
}: AuthPanelProps) {
```

After `const [submitting, setSubmitting] = useState(false);` (line 76):

```ts
  const [submitting, setSubmitting] = useState(false);
```

add:

```ts
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
```

In the signed-in account menu, the "Profile settings" button block currently ends like this (lines 354-368):

```tsx
            ) : (
              <button
                className="button-secondary auth-panel__menu-item"
                type="button"
                onClick={() => {
                  setProfileName(user.name ?? "");
                  setProfileLevel(user.defaultLevel);
                  setProfileTargetTime(user.defaultTargetTime);
                  setProfileOpen(true);
                }}
                disabled={loading}
              >
                Profile settings
              </button>
            )}
            {canUpgrade ? (
```

Insert a "Download my data" link and the delete-account block between the profile button's closing `)}` and `{canUpgrade ? (`:

```tsx
            ) : (
              <button
                className="button-secondary auth-panel__menu-item"
                type="button"
                onClick={() => {
                  setProfileName(user.name ?? "");
                  setProfileLevel(user.defaultLevel);
                  setProfileTargetTime(user.defaultTargetTime);
                  setProfileOpen(true);
                }}
                disabled={loading}
              >
                Profile settings
              </button>
            )}
            <a
              className="button-secondary auth-panel__menu-item"
              href="/api/auth/me/export"
            >
              Download my data
            </a>
            {deleteConfirmOpen ? (
              <div className="auth-panel__delete-confirm">
                <p>
                  This permanently deletes your account, saved reports, and
                  cancels any subscription. This can&apos;t be undone.
                </p>
                <div className="auth-panel__delete-confirm-actions">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => setDeleteConfirmOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="button-secondary auth-panel__menu-item--danger"
                    type="button"
                    onClick={async () => {
                      setDeleting(true);

                      try {
                        await onDeleteAccount();
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <span className="button-loading">
                        <OctagonSpinner size={16} />
                        Deleting...
                      </span>
                    ) : (
                      "Yes, delete my account"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="button-secondary auth-panel__menu-item auth-panel__menu-item--danger"
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={loading}
              >
                Delete account
              </button>
            )}
            {canUpgrade ? (
```

- [ ] **Step 3: Add delete-confirm and danger-button styles to `styles/_auth.scss`**

In `styles/_auth.scss`, the upgrade-button styles currently end with:

```scss
.auth-panel--signed-in .auth-panel__upgrade:hover {
  background: var(--button-hover);
}
```

(lines 517-519). Add new rules immediately after it:

```scss
.auth-panel--signed-in .auth-panel__upgrade:hover {
  background: var(--button-hover);
}

.auth-panel--signed-in .auth-panel__menu-item--danger {
  border-color: var(--red);
  color: var(--red);
}

.auth-panel--signed-in .auth-panel__menu-item--danger:hover {
  border-color: var(--red);
  background: var(--red);
  color: #fff;
}

.auth-panel__delete-confirm {
  display: grid;
  gap: 8px;
  border: 1px solid var(--red);
  border-radius: 10px;
  padding: 10px;
  background: var(--error-soft);
}

.auth-panel__delete-confirm p {
  margin: 0;
  color: var(--ink);
  font-size: 0.86rem;
  line-height: 1.4;
}

.auth-panel__delete-confirm-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.auth-panel__delete-confirm-actions button {
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 0 12px;
  white-space: nowrap;
}
```

- [ ] **Step 4: Add `handleDeleteAccount` and wire it into `app/page.tsx`**

In the `@/lib/apiClient` import block in `app/page.tsx` (lines 59-75), the imports are alphabetically ordered. Add `deleteAccount,` immediately before `deleteRemoteReport,`:

```ts
import {
  AuthFormInput,
  AuthUser,
  deleteAccount,
  deleteRemoteReport,
  getCurrentUser,
  loadRemoteReports,
  logIn,
  logOut,
  openBillingPortal,
  ProfileFormInput,
  resendEmailVerification,
  saveRemoteReport,
  signUp,
  startCheckout,
  syncBillingStatus,
  updateProfile,
} from "@/lib/apiClient";
```

After `handleLogout` (lines 529-550):

```ts
  async function handleLogout() {
    try {
      await logOut();
      setUser(null);
      setSavedReports(loadSavedReports());
      setToast({
        id: Date.now(),
        title: "Signed out",
        message: "Ocht is showing reports saved on this device.",
        tone: "success",
      });
      trackEvent("logout_completed");
    } catch (error) {
      setToast({
        id: Date.now(),
        title: "Logout failed",
        message:
          error instanceof Error ? error.message : "Ocht could not log out.",
        tone: "error",
      });
    }
  }
```

add:

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
          error instanceof Error
            ? error.message
            : "Ocht could not delete your account.",
        tone: "error",
      });
      throw error;
    }
  }
```

In the `<AuthPanel />` usage (lines 1137-1154), after `onSaveProfile={handleSaveProfile}`:

```tsx
          <AuthPanel
            user={user}
            loading={authLoading || reportsLoading}
            billingLoading={billingLoading}
            distanceUnit={distanceUnit}
            onDistanceUnitChange={setDistanceUnit}
            avatarColor={avatarColor}
            onAvatarColorChange={updateAvatarColor}
            avatarIcon={avatarIcon}
            onAvatarIconChange={updateAvatarIcon}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onLogout={handleLogout}
            onStartCheckout={handleStartCheckout}
            onManageBilling={handleManageBilling}
            onResendVerification={handleResendVerification}
            onSaveProfile={handleSaveProfile}
          />
```

becomes:

```tsx
          <AuthPanel
            user={user}
            loading={authLoading || reportsLoading}
            billingLoading={billingLoading}
            distanceUnit={distanceUnit}
            onDistanceUnitChange={setDistanceUnit}
            avatarColor={avatarColor}
            onAvatarColorChange={updateAvatarColor}
            avatarIcon={avatarIcon}
            onAvatarIconChange={updateAvatarIcon}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onLogout={handleLogout}
            onStartCheckout={handleStartCheckout}
            onManageBilling={handleManageBilling}
            onResendVerification={handleResendVerification}
            onSaveProfile={handleSaveProfile}
            onDeleteAccount={handleDeleteAccount}
          />
```

- [ ] **Step 5: Run type-check and manually verify in the dev server**

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npm run dev`

In a browser at `http://127.0.0.1:3002`, sign in with a test account, open the account menu, and confirm:
1. "Download my data" appears between "Profile settings" and "Delete account", and clicking it downloads `ocht-data-export.json`.
2. Clicking "Delete account" shows the inline warning with "Cancel" and "Yes, delete my account"; "Cancel" returns to the normal menu.
3. (Optional, only if you have a disposable test account) Clicking "Yes, delete my account" signs the account out and shows the "Account deleted" toast.

Stop the dev server after verifying (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add lib/apiClient.ts components/AuthPanel.tsx styles/_auth.scss app/page.tsx
git commit -m "Add account deletion and data export to the account menu"
```

---

## Task 8: Update privacy policy copy

**Files:**
- Modify: `app/privacy/page.tsx:37-51`

- [ ] **Step 1: Update the "Third Parties" and "Retention And Deletion" sections**

In `app/privacy/page.tsx`, the current sections read:

```tsx
      <h2>Third Parties</h2>
      <p>
        Stripe processes checkout, billing portal, and subscription webhook
        events. Hosting, database, email, and analytics providers may process
        operational data when Ocht is deployed. Analytics events are limited to
        product actions such as report generation, checkout starts, and export
        clicks; Ocht does not intentionally send passwords, payment details,
        full race split payloads, or account emails in analytics events.
      </p>

      <h2>Retention And Deletion</h2>
      <p>
        Account and report data is retained while your account exists. Contact
        support to request account or report deletion.
      </p>
```

Replace them with:

```tsx
      <h2>Third Parties</h2>
      <p>
        Stripe processes checkout, billing portal, and subscription webhook
        events. Hosting, database, email, and analytics providers may process
        operational data when Ocht is deployed. Analytics events are limited to
        product actions such as report generation, checkout starts, and export
        clicks; Ocht does not intentionally send passwords, payment details,
        full race split payloads, or account emails in analytics events.
        Analytics only run after you accept the cookie banner, and you can
        change that choice at any time from the "Cookie preferences" link in
        the footer.
      </p>

      <h2>Retention And Deletion</h2>
      <p>
        Account and report data is retained while your account exists. You can
        download a copy of your data or permanently delete your account at any
        time from the account menu. Deleting your account also cancels any
        active subscription.
      </p>
```

- [ ] **Step 2: Manually verify**

Run: `npm run dev`

In a browser, visit `http://127.0.0.1:3002/privacy` and confirm the "Third Parties" and "Retention And Deletion" sections render the updated copy.

Stop the dev server after verifying (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add app/privacy/page.tsx
git commit -m "Update privacy policy for account deletion, export, and cookie consent"
```

---

## Final Verification

- [ ] Run the full test suite: `npx vitest run`
  Expected: All tests pass, including the new tests from Tasks 1, 2, 5, and 6.
- [ ] Run the type-checker: `npx tsc --noEmit`
  Expected: No errors.
