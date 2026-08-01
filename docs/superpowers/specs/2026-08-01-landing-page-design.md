# Landing page for logged-out visitors — design

## Problem

`app/page.tsx` currently serves the full report-builder tool at `/` to every visitor, logged in or not. There is no marketing surface — a new visitor lands straight in a form. This makes Ocht compare poorly to similar HYROX-adjacent tools that lead with a pitch before the product.

## Goals

- Give logged-out visitors a real landing page at `/` that pitches the product.
- Logged-in visitors keep going straight to the tool — zero added friction for returning users.
- Landing page shows off Ocht's actual differentiators (roxzone tax, athlete archetype, ranked time leaks), not generic fitness-app copy.
- Reuse the supplied event photo (`public/IMG-20251130-WA0012.jpg`) as a subtle hero treatment, consistent with the existing dark acid-green design language (see `--lime`, `--surface`, `--panel`, `--font-display`, `--font-mono` tokens in `styles/_base.scss`).

## Non-goals

- No testimonials or social proof — none exist yet; fabricating them is out.
- No pricing-table detail beyond the existing single premium tier / paywall messaging already in the app.
- No changes to the report engine, billing, or Strava integration logic.

## Routing

The tool moves from `/` to `/app`. `/` becomes the new marketing landing page.

- **`app/page.tsx`** → new landing page component (logged-out marketing content).
- **`app/app/page.tsx`** → today's `app/page.tsx` content, unchanged in behavior. It keeps working for both logged-in and logged-out visitors exactly as `/` does today (anonymous users can still build a report and save locally; nothing about the tool's own auth handling changes).
- **New `middleware.ts`** at the repo root: on `GET /` only, check for the presence of the `ocht_session` cookie (name from `lib/session.ts`). If present, redirect to `/app`, preserving the full query string. If absent, let the request through to render the landing page. This is a presence check, not a validity check — the session token itself is opaque and only verifiable against the DB (`lib/session.ts` — `hashSessionToken` + DB lookup), which isn't available cheaply at the edge. A stale/expired cookie just means `/app` loads and its existing client-side `getCurrentUser()` effect resolves to logged-out state, same as it does today. Matcher scoped to `/` exactly, so `/app`, API routes, and static assets are untouched.

**Why this is low-risk:** Stripe checkout/portal returns and the Strava OAuth callback already redirect to `${appUrl}/?checkout=success...`, `/?strava=connected`, etc. (`app/api/billing/checkout/route.ts`, `app/api/billing/portal/route.ts`, `app/api/strava/callback/route.ts`). None of those routes need to change — the middleware redirect for a logged-in session carries the query string straight through to `/app?checkout=success...`, where the existing `useEffect` handlers in the moved page component keep working unmodified.

**CTA link behavior on the landing page:**
- "Sign up free" / "Build my free report" → link to `/app`, opening the sign-up form (mirrors the existing internal `mode` toggle in `components/AuthPanel.tsx` — exact wiring, e.g. a query flag consumed and stripped like the existing `tab`/`checkout`/`strava` params in `app/app/page.tsx`, is a planning-stage detail).
- "Log in" → same pattern, opening the login form instead.
- "See a sample report" / "Try it with sample data" → link to `/app?sample=1`; on load, `/app` applies `sampleReportPreset` (same data already used by `DemoModal`'s "load sample" flow) and strips the param, so a logged-out visitor immediately sees a populated report without signing up.

## Page structure (scope: hero + how-it-works + one feature highlight + footer CTA)

Approved wireframe order:

1. **Lightweight header** — `ocht.` wordmark, "Log in", "Sign up free". Distinct from the in-app `site-header` (no events nav, no unit/theme menu) — this is a marketing header, not the app chrome.
2. **Hero** — side-panel treatment (approved option): headline + subcopy + primary/secondary CTA on solid dark ground (left), event photo confined to a panel (right) with a horizontal gradient fade into the solid ground so the photo reads as texture, not focal point. Photo lives at `public/landing/hero.jpg` (moved from its current drop location at `public/IMG-20251130-WA0012.jpg`), rendered via `next/image` with `priority` since it's above the fold.
3. **How it works** — 3-step strip (log splits → Ocht does the math → see where you lost time). Static content, no data dependency.
4. **Feature highlight** — two-column: left is copy + a bulleted list of real differentiators (roxzone tax, archetype, ranked leaks) with a "try it with sample data" CTA; right is a small illustrative report-preview card (NOT the real `ReportPanel` — that component is large, interactive, and premium-gated in places; a lightweight decorative card matching the report's visual language — mono eyebrow, lime top accent bar, tabular-nums score — is enough to sell the idea without dragging in report internals).
5. **Footer CTA band** — closing headline + "Build my free report" CTA.
6. **Minimal footer** — wordmark + Privacy/Terms links (existing `/privacy`, `/terms` routes).

## Theming

The wireframe used fixed hex values for fast iteration in the browser companion, but the real implementation must map to the existing themed tokens (`--lime`, `--ink`, `--surface`, `--panel`, `--line`, `--font-display` (Saira Condensed), `--font-mono` (DM Mono), `--font-body` (Inter)) so the landing page respects the site's light/dark toggle — same rule already established for the rest of the app (see design-language notes: never hardcode mockup colors).

Exception: the hero band itself is an intentionally fixed dark canvas regardless of app theme — there's already precedent for this in `components/ShareCards.tsx`, which fixes its palette so exported cards look identical regardless of viewer theme. The hero photo needs a consistently dark, moody ground to stay subtle; forcing it to flip to a light background in light mode would fight the photo. Sections below the hero (how-it-works, feature highlight, footer CTA) follow theme tokens normally.

## File organization

- `components/landing/LandingHero.tsx`
- `components/landing/LandingHowItWorks.tsx`
- `components/landing/LandingFeatureHighlight.tsx`
- `components/landing/LandingFooterCta.tsx`
- `app/page.tsx` — composes the above, plus the lightweight marketing header (no need for a separate component if it stays this small).
- `styles/_landing.scss` — new partial, imported into the main stylesheet entry point alongside the existing `_hero.scss`/`_layout.scss` partials.
- `middleware.ts` — new file at repo root.

## Follow-ups (not blocking this spec)

- `app/sitemap.ts` currently lists `""` (root) at priority 1 — that's now correctly the marketing page. Consider whether `/app` should also be listed (lower priority) once this ships; not required for launch.
- The exact mechanism for auto-opening `AuthPanel` in signup vs. login mode from a landing CTA is left to the implementation plan — `AuthPanel` already has internal `mode` state; the plan just needs to decide how a landing-page link expresses "open in signup mode" (a query param read once and stripped, matching the existing pattern for `tab`, `checkout`, and `strava` params in the moved page component).
