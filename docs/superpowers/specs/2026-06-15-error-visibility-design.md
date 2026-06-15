# Error Visibility — Design Spec

**Status:** Approved
**Date:** 2026-06-15

## Goal

Right now, an unhandled render error in the Ocht app falls through to Next.js's
default error UI, and there is no record of it anywhere. This spec adds proper
error boundaries (matching the app's dark theme) and a lightweight reporting
path so that client-side errors are visible in Vercel's runtime logs — the
monitoring tool already chosen for this project (no third-party APM/SDK).

This is sub-project 1 of 4 in the "Beta → Production" hardening work (the
others — API abuse protection, account & data rights, billing resilience —
are separate specs).

## Architecture

Three new files:

1. `app/error.tsx` — a route-segment error boundary. Next.js renders this for
   any unhandled error thrown while rendering a page (but not the root
   layout). It's a client component that receives `{ error, reset }`.
2. `app/global-error.tsx` — the root-layout error boundary. Next.js renders
   this only when the root layout itself throws, and it must render its own
   `<html>`/`<body>` since the normal layout didn't mount.
3. `app/api/errors/route.ts` — a POST endpoint both boundaries call to report
   the error server-side, where `console.error` output is captured by
   Vercel's runtime logs.

Plus a small style addition in `styles/_base.scss` for the error page layout
and "Try again" button.

## Components

### `app/error.tsx`

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

Notes:
- Reuses the existing `.not-found` layout class (centered, padded column)
  plus a new `.error-page` modifier for the action row.
- `reset()` is Next's built-in mechanism to re-render the segment without a
  full page reload — appropriate for transient errors.
- The `fetch` is fire-and-forget; `.catch()` swallows network errors so a
  failed report never compounds the original error.

### `app/global-error.tsx`

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

Notes:
- Root-layout errors are rare (they mean `app/layout.tsx` itself threw), so
  this fallback uses inline styles and hardcoded dark-theme colors rather
  than relying on global SCSS, since the normal `<head>`/stylesheet pipeline
  may not be intact.
- `data-theme="dark"` is set directly since `app/layout.tsx`'s theme script
  (which sets this on `documentElement`) won't have run.

### `app/api/errors/route.ts`

```tsx
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

Notes:
- Always returns `200 { ok: true }` — this endpoint exists purely to get a
  line into the logs; it must never itself become a source of client-visible
  errors.
- `logServerError` (existing, in `lib/logging.ts`) already redacts secrets
  via `sanitizeError`/`sanitizeValue`, so even if a stack trace contains an
  env var value it gets scrubbed before logging.
- Truncation caps prevent a malicious/buggy client from writing huge log
  entries.
- **Not rate-limited in this spec.** Spec 2 (API abuse protection) wires up
  the existing `lib/security.ts` rate limiter across API routes and should
  include this one in that pass.

### Styling — `styles/_base.scss`

Add alongside the existing `.not-found` rules:

```scss
.error-page__actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}
```

`.btn` and `.btn--primary` already exist (used elsewhere, e.g.
`ReportPanel.tsx`) and need no changes.

## Data Flow

1. A render error occurs anywhere in a page → Next.js mounts `app/error.tsx`
   with the error.
2. On mount, the boundary POSTs error details to `/api/errors`.
3. The API route sanitizes/truncates the payload and calls
   `console.error("Client error reported", {...})` via `logServerError`.
4. Vercel's runtime log stream captures this `console.error` output, making
   it visible in the Vercel dashboard.
5. The user sees a themed error page with "Try again" (calls `reset()`,
   re-rendering the segment) or "Back to Ocht".

If the root layout itself throws, `app/global-error.tsx` handles it instead,
following the same reporting flow but with a self-contained fallback UI.

## Error Handling

- The reporting `fetch` calls have `.catch(() => {})` — a failure to report
  must never throw or surface to the user.
- `app/api/errors/route.ts` wraps its body in try/catch and always returns
  `200`, even if `request.json()` fails (e.g., malformed body).
- `logServerError` already handles non-`Error` inputs and redacts sensitive
  values, so no additional sanitization is needed beyond truncation.

## Testing

- `lib/logging.test.ts` already exists and covers `sanitizeError`/
  `logServerError` — no changes needed there.
- New test: `app/api/errors/route.test.ts` — verify the route returns
  `200 { ok: true }` for a well-formed payload, a malformed/empty body, and
  an oversized payload (confirms truncation), and that `logServerError` is
  called with the expected sanitized/truncated shape (mock `lib/logging`).
- Manual verification (during implementation): temporarily throw inside a
  page component, confirm `app/error.tsx` renders with working "Try again"
  and "Back to Ocht", and that a `Client error reported` line appears in the
  dev server console (proxy for Vercel's log capture).
