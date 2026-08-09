# Error Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add themed error boundaries (`app/error.tsx`, `app/global-error.tsx`) and a `/api/errors` reporting endpoint so unhandled client-side errors are visible in Vercel's runtime logs instead of disappearing.

**Architecture:** A new POST API route (`app/api/errors/route.ts`) receives error reports and logs them server-side via the existing `logServerError` helper (which already redacts secrets). Two new error-boundary components POST to this endpoint on mount and render themed fallback UIs reusing the existing `.not-found` layout pattern and `.btn`/`.btn--primary`/`.btn--secondary` button classes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Vitest, SCSS.

**Spec:** `docs/superpowers/specs/2026-06-15-error-visibility-design.md`

---

### Task 1: Error reporting API endpoint

**Files:**
- Create: `app/api/errors/route.ts`
- Test: `app/api/errors/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/api/errors/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logServerError } from "@/lib/logging";
import { POST } from "./route";

vi.mock("@/lib/logging", () => ({
  logServerError: vi.fn(),
}));

function postRequest(body: unknown) {
  return new Request("http://localhost/api/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/errors", () => {
  beforeEach(() => {
    vi.mocked(logServerError).mockClear();
  });

  it("logs a well-formed payload and returns ok", async () => {
    const response = await POST(
      postRequest({
        message: "Boom",
        digest: "abc123",
        stack: "Error: Boom\n at foo",
        pathname: "/report",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(logServerError).toHaveBeenCalledWith("Client error reported", {
      message: "Boom",
      digest: "abc123",
      stack: "Error: Boom\n at foo",
      pathname: "/report",
    });
  });

  it("truncates oversized fields before logging", async () => {
    const longMessage = "x".repeat(600);
    const longStack = "y".repeat(5000);

    await POST(
      postRequest({
        message: longMessage,
        stack: longStack,
        pathname: "/report",
      }),
    );

    const [, payload] = vi.mocked(logServerError).mock.calls[0];
    expect((payload as Record<string, string>).message).toHaveLength(500);
    expect((payload as Record<string, string>).stack).toHaveLength(4000);
  });

  it("returns ok and logs even with a malformed body", async () => {
    const response = await POST(postRequest("not json"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(logServerError).toHaveBeenCalledWith(
      "Failed to process client error report",
      expect.anything(),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/api/errors/route.test.ts`
Expected: FAIL — `./route` module does not exist yet.

- [ ] **Step 3: Implement the route**

Create `app/api/errors/route.ts`:

```ts
import { NextResponse } from "next/server";
import { logServerError } from "@/lib/logging";

const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 4000;
const MAX_PATHNAME_LENGTH = 300;

function truncate(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.length > max ? value.slice(0, max) : value;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    logServerError("Client error reported", {
      message: truncate(body?.message, MAX_MESSAGE_LENGTH),
      digest: truncate(body?.digest, 100),
      stack: truncate(body?.stack, MAX_STACK_LENGTH),
      pathname: truncate(body?.pathname, MAX_PATHNAME_LENGTH),
    });
  } catch (error) {
    logServerError("Failed to process client error report", error);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/api/errors/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/errors/route.ts app/api/errors/route.test.ts
git commit -m "Add /api/errors endpoint for client error reporting"
```

---

### Task 2: Route-segment error boundary (`app/error.tsx`)

**Files:**
- Modify: `styles/_base.scss:206-209` (after the existing `.not-found p:last-child` rule)
- Create: `app/error.tsx`

- [ ] **Step 1: Add the error-page action row styles**

In `styles/_base.scss`, immediately after the existing `.not-found` block (after line 209, `.not-found p:last-child { ... }`), add:

```scss

.error-page__actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}
```

- [ ] **Step 2: Create the error boundary**

Create `app/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        pathname: window.location.pathname,
      }),
    }).catch(() => {
      // Reporting failures must never break the error UI.
    });
  }, [error]);

  return (
    <main className="not-found error-page">
      <p className="eyebrow">Ocht</p>
      <h1>Something went wrong</h1>
      <p>
        That page hit an unexpected error. You can try again, or head back to
        the dashboard.
      </p>
      <div className="error-page__actions">
        <button type="button" className="btn btn--primary" onClick={() => reset()}>
          Try again
        </button>
        <a className="btn btn--secondary" href="/">
          Back to Ocht
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `app/error.tsx` or `styles/_base.scss`.

- [ ] **Step 4: Commit**

```bash
git add styles/_base.scss app/error.tsx
git commit -m "Add themed route error boundary that reports to /api/errors"
```

---

### Task 3: Root error boundary (`app/global-error.tsx`)

**Files:**
- Create: `app/global-error.tsx`

- [ ] **Step 1: Create the root error boundary**

Create `app/global-error.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        pathname: window.location.pathname,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en" data-theme="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          alignContent: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 48,
          background: "#0e1914",
          color: "#f4f7ef",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div>
          <p style={{ color: "#9fb39a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Ocht
          </p>
          <h1 style={{ fontSize: "2.4rem", margin: "8px 0 16px" }}>Something went wrong</h1>
          <p style={{ color: "#9fb39a", marginBottom: 24 }}>
            The app hit an unexpected error. Try reloading the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#c8ff2e",
              color: "#11160f",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to `app/global-error.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/global-error.tsx
git commit -m "Add root error boundary with self-contained dark fallback UI"
```

---

### Task 4: End-to-end verification

**Files:**
- Create (temporary, not committed): `app/test-error/page.tsx`

This task verifies the full flow (boundary renders → reports to `/api/errors` → logged server-side) using a throwaway route, then removes it.

- [ ] **Step 1: Create a temporary error-throwing page**

Create `app/test-error/page.tsx`:

```tsx
export default function TestErrorPage() {
  throw new Error("Test error for boundary verification");
}
```

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

Wait for it to be ready on `http://127.0.0.1:3002`.

- [ ] **Step 3: Trigger the route-segment boundary**

Navigate to `http://127.0.0.1:3002/test-error`.

Expected:
- The page renders the dark-themed "Something went wrong" UI from `app/error.tsx` (eyebrow "Ocht", heading, body copy, "Try again" and "Back to Ocht" buttons styled per `.not-found`/`.btn`/`.btn--primary`/`.btn--secondary`).
- The dev server console prints a `Client error reported` log line (via `logServerError`) containing `message: "Test error for boundary verification"`, a `stack`, and `pathname: "/test-error"`.

- [ ] **Step 4: Verify the action buttons**

- Click **"Back to Ocht"** — confirm it navigates to `/` and the normal app shell renders.
- Navigate back to `http://127.0.0.1:3002/test-error`, click **"Try again"** — confirm the page re-renders the same error boundary (the page still throws, so the same UI reappears) without a full browser reload.

- [ ] **Step 5: Remove the temporary page and stop the dev server**

```bash
rm app/test-error/page.tsx
```

Stop the dev server (Ctrl+C / kill the background process).

- [ ] **Step 6: Confirm a clean working tree**

```bash
git status
```

Expected: no uncommitted changes (the temporary `app/test-error/page.tsx` was removed and never staged).

No commit for this task — it's verification only. `app/global-error.tsx` (Task 3) is not separately live-tested here since triggering a root-layout error reliably in dev is impractical; its reporting logic is identical to `app/error.tsx`'s (verified in Step 3) and its fallback markup was type-checked in Task 3.
