# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the app into a logged-out marketing landing page at `/` and the existing report tool at `/app`, with a middleware redirect that sends logged-in visitors straight past the landing page.

**Architecture:** `app/page.tsx` (today's report tool) moves unchanged to `app/app/page.tsx`. A new `app/page.tsx` becomes the marketing landing page, composed from four new components under `components/landing/`. A new root `middleware.ts` checks for the presence of the `ocht_session` cookie on `GET /` only and redirects to `/app` (preserving the query string) when present. Landing CTAs link to `/app?auth=login`, `/app?auth=signup`, and `/app?sample=1`; the moved page component reads and consumes those query params the same way it already does for `tab`/`checkout`/`strava`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Sass partials, Vitest (node environment, no jsdom).

**Deviations from the spec, found during planning:**
- The spec suggested `next/image` for the hero photo. The codebase has zero existing usage of `next/image` or `<img>` anywhere (all imagery is inline SVG or CSS `background-image`), and the photo is a purely decorative panel, not content. Using a plain CSS `background-image` (matching the approved wireframe) is more consistent with existing conventions and simpler. This does not change any approved behavior, just the rendering mechanism.
- The spec listed a "minimal footer" as part of the new landing page. `components/SiteFooter.tsx` is already rendered globally by `app/layout.tsx` on every route, including the new `/` — it already has the wordmark and Privacy/Terms/etc. links the spec described. Building a second one would duplicate it. The landing page therefore only adds the **footer CTA band** (the marketing closing pitch), not a nav footer.
- "See a sample report" in the hero uses `.btn.btn--secondary` (matching the existing primary/secondary CTA pairing already used in `components/Hero.tsx`) instead of a bespoke underlined text link from the wireframe, for visual consistency with the rest of the app.

**Note on intermediate state:** Between Task 1 (tool moves to `/app`) and Task 5 (new landing page lands at `/`), the root route has no page and will 404. This is expected on a feature branch worked through task-by-task and is resolved by the end of Task 5, before merge.

---

### Task 1: Move the report tool to `/app`, wire landing query params

**Files:**
- Move: `app/page.tsx` → `app/app/page.tsx`
- Modify: `components/AuthPanel.tsx`
- Modify: `app/app/page.tsx` (post-move)

- [ ] **Step 1: Move the page file**

```bash
mkdir -p app/app
git mv app/page.tsx app/app/page.tsx
```

- [ ] **Step 2: Export the auth mode type and add a controlled `initialMode` prop to `AuthPanel`**

In `components/AuthPanel.tsx`, change:

```ts
type AuthMode = "login" | "signup";
```

to:

```ts
export type AuthMode = "login" | "signup";
```

Add `initialMode` to the props type:

```ts
type AuthPanelProps = {
  user: AuthUser | null;
  loading: boolean;
  distanceUnit: DistanceUnit;
  onDistanceUnitChange: (unit: DistanceUnit) => void;
  avatarColor: string;
  avatarIcon: string;
  onLogin: (input: AuthFormInput) => Promise<void>;
  onSignup: (input: AuthFormInput) => Promise<void>;
  onLogout: () => Promise<void>;
  initialMode?: AuthMode | null;
};
```

Update the function signature and seed `mode` from it, then sync if the prop changes after mount (the landing page sets it asynchronously from a URL query param, after `AuthPanel` has already mounted with `mode: null`):

```ts
export function AuthPanel({
  user,
  loading,
  distanceUnit,
  onDistanceUnitChange,
  avatarColor,
  avatarIcon,
  onLogin,
  onSignup,
  onLogout,
  initialMode = null,
}: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode | null>(initialMode);
```

Add this effect directly below the existing theme/unit effect (after the `useEffect` that calls `onDistanceUnitChange(readPreferredDistanceUnit())`):

```ts
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);
```

- [ ] **Step 3: Add `sample` and `auth` query param handling to the moved page**

In `app/app/page.tsx`, add a new state near the other `useState` declarations (next to `avatarIcon`/`avatarColor`):

```ts
  const [authModeParam, setAuthModeParam] = useState<AuthMode | null>(null);
```

Import `AuthMode` alongside the existing `AuthPanel` import:

```ts
import { AuthPanel, type AuthMode } from "@/components/AuthPanel";
```

Add a new effect right after the existing tab-parsing effect (the one that sets `customTemplates`/`onboardingDismissed`/`beginnerGuideDismissed`/avatar state and reads the `tab` param — keep that effect exactly as-is, add this as a separate new effect below it):

```ts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sampleParam = params.get("sample");
    const authParam = params.get("auth");

    if (sampleParam === "1") {
      applyReportPreset(sampleReportPreset, "Sample race loaded");
    }

    if (authParam === "login" || authParam === "signup") {
      setAuthModeParam(authParam);
    }

    if (sampleParam || authParam) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
```

Pass the new prop to `AuthPanel` in the JSX (inside `<div className="site-header__actions">`):

```tsx
          <AuthPanel
            user={user}
            loading={authLoading || reportsLoading}
            distanceUnit={distanceUnit}
            onDistanceUnitChange={setDistanceUnit}
            avatarColor={avatarColor}
            avatarIcon={avatarIcon}
            onLogin={handleLogin}
            onSignup={handleSignup}
            onLogout={handleLogout}
            initialMode={authModeParam}
          />
```

- [ ] **Step 4: Verify nothing broke**

Run: `npm run test`
Expected: all existing suites still pass (no test references the old `app/page.tsx` path directly — they import from `@/lib/*` and `@/components/*`, which are unaffected by the move).

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/app/page.tsx components/AuthPanel.tsx
git commit -m "refactor: move report tool to /app, wire sample/auth query params"
```

---

### Task 2: Add the logged-in redirect middleware

**Files:**
- Create: `middleware.ts`
- Test: `middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `middleware.test.ts`:

```ts
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function requestTo(url: string, cookie?: string) {
  return new NextRequest(url, cookie ? { headers: { cookie } } : undefined);
}

describe("middleware", () => {
  it("lets logged-out visitors through to the landing page", () => {
    const response = middleware(requestTo("http://localhost/"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a logged-in visitor from / to /app", () => {
    const response = middleware(
      requestTo("http://localhost/", "ocht_session=abc123"),
    );

    expect(response.headers.get("location")).toBe("http://localhost/app");
  });

  it("preserves the query string when redirecting", () => {
    const response = middleware(
      requestTo(
        "http://localhost/?checkout=success&return_to=%2Fapp",
        "ocht_session=abc123",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/app?checkout=success&return_to=%2Fapp",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- middleware.test.ts`
Expected: FAIL — `Cannot find module './middleware'`

- [ ] **Step 3: Write the middleware**

Create `middleware.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

// Mirrors sessionCookieName in lib/session.ts. Kept as a local literal
// (rather than importing lib/session.ts, which pulls in node:crypto) so this
// file has no Node.js dependencies and stays safe to run in the Edge
// middleware runtime.
const SESSION_COOKIE_NAME = "ocht_session";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSession) {
    return NextResponse.next();
  }

  const appUrl = request.nextUrl.clone();
  appUrl.pathname = "/app";

  return NextResponse.redirect(appUrl);
}

export const config = {
  matcher: "/",
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- middleware.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add middleware.ts middleware.test.ts
git commit -m "feat: redirect logged-in visitors from / to /app"
```

---

### Task 3: Hero section (`LandingHero`) and the landing stylesheet

**Files:**
- Create: `components/landing/LandingHero.tsx`
- Create: `styles/_landing.scss`
- Move: `public/IMG-20251130-WA0012.jpg` → `public/landing/hero.jpg`

- [ ] **Step 1: Move the photo**

```bash
mkdir -p public/landing
git mv public/IMG-20251130-WA0012.jpg public/landing/hero.jpg
```

- [ ] **Step 2: Create the hero component**

Create `components/landing/LandingHero.tsx`:

```tsx
import Link from "next/link";

export function LandingHero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero__text">
        <p className="landing-hero__eyebrow">Race report engine</p>
        <h1>
          Know exactly where
          <br />
          your race was won.
        </h1>
        <p className="landing-hero__lead">
          Enter your splits and station times — Ocht turns them into a
          race-day breakdown of leaks, pacing, and where you actually lost
          the most time.
        </p>
        <div className="landing-hero__actions">
          <Link
            className="btn btn--primary btn--cut btn--lg"
            href="/app?auth=signup"
          >
            Build my free report
          </Link>
          <Link className="btn btn--secondary btn--lg" href="/app?sample=1">
            See a sample report
          </Link>
        </div>
      </div>
      <div
        className="landing-hero__photo"
        role="img"
        aria-label="Two athletes carrying sandbags during a HYROX race"
      />
    </section>
  );
}
```

- [ ] **Step 3: Create the landing stylesheet with the hero + page background rules**

Create `styles/_landing.scss`:

```scss
// Landing page (logged-out marketing surface at "/"). The hero band is an
// intentionally fixed dark canvas regardless of app theme — same precedent
// as the fixed palette in _share.scss — so the photo always sits on a
// consistent dark ground. Every other section below it uses the normal
// themed tokens from _base.scss.

.landing-page {
  background: var(--paper);
}

.landing-hero {
  display: grid;
  grid-template-columns: 1fr 42%;
  min-height: 420px;
  background: #08100d;
  color: #f4f7ef;
  overflow: hidden;
}

.landing-hero__text {
  padding: 64px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.landing-hero__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #c8ff2e;
  font-weight: 600;
  margin: 0 0 12px;
}

.landing-hero__text h1 {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.05;
  font-weight: 800;
  margin: 0 0 16px;
}

.landing-hero__lead {
  font-size: 1rem;
  color: rgba(244, 247, 239, 0.75);
  max-width: 32rem;
  margin: 0 0 28px;
}

.landing-hero__actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.landing-hero__photo {
  position: relative;
  background-image:
    linear-gradient(90deg, #08100d 0%, rgba(8, 16, 13, 0) 30%),
    url("/landing/hero.jpg");
  background-size: cover;
  background-position: 50% 22%;
}

@media (max-width: 760px) {
  .landing-hero {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .landing-hero__text {
    padding: 40px 24px;
  }

  .landing-hero__photo {
    height: 220px;
    background-image:
      linear-gradient(180deg, rgba(8, 16, 13, 0) 40%, #08100d 100%),
      url("/landing/hero.jpg");
  }
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: no errors (the component isn't imported anywhere yet, so this only checks syntax/types of the new file itself — full visual verification happens in Task 6).

- [ ] **Step 5: Commit**

```bash
git add components/landing/LandingHero.tsx styles/_landing.scss public/landing/hero.jpg
git commit -m "feat: add landing page hero section"
```

---

### Task 4: How-it-works and feature-highlight sections

**Files:**
- Create: `components/landing/LandingHowItWorks.tsx`
- Create: `components/landing/LandingFeatureHighlight.tsx`
- Modify: `styles/_landing.scss`

- [ ] **Step 1: Create the how-it-works component**

Create `components/landing/LandingHowItWorks.tsx`:

```tsx
const steps = [
  {
    number: "01",
    title: "Log your splits",
    body: "Run times, station times, and your official finish if you've got it.",
  },
  {
    number: "02",
    title: "Ocht does the math",
    body: "Pacing, roxzone tax, and an athlete archetype — calculated, not guessed.",
  },
  {
    number: "03",
    title: "See where you lost time",
    body: "A ranked list of leaks so next race, you train the right thing.",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="landing-section landing-how">
      <p className="landing-section__kicker">How it works</p>
      <h2>Three steps, one honest report</h2>
      <div className="landing-how__steps">
        {steps.map((step) => (
          <article className="landing-how__step" key={step.number}>
            <span className="landing-how__number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create the feature-highlight component**

Create `components/landing/LandingFeatureHighlight.tsx`:

```tsx
import Link from "next/link";

const differentiators = [
  "Roxzone tax — how much the transitions actually cost you",
  "Athlete archetype — Runner, Powerhouse, Fader, and more",
  "Ranked time leaks — the one thing to fix before your next race",
];

export function LandingFeatureHighlight() {
  return (
    <section className="landing-section landing-feature">
      <div className="landing-feature__copy">
        <h2>This isn&apos;t a finish-time calculator.</h2>
        <p>
          Most race apps stop at &quot;here&apos;s your time.&quot; Ocht
          tells you why.
        </p>
        <ul className="landing-feature__list">
          {differentiators.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <Link className="btn btn--primary" href="/app?sample=1">
          Try it with sample data
        </Link>
      </div>
      <div className="landing-feature__preview" aria-hidden="true">
        <div className="landing-feature__preview-head">
          <span>Race readiness</span>
          <span className="landing-feature__badge">Powerhouse</span>
        </div>
        <div className="landing-feature__score">
          <span className="landing-feature__score-number">78</span>
          <span className="landing-feature__score-label">/ 100 overall</span>
        </div>
        <div className="landing-feature__row">
          <span>Roxzone transitions</span>
          <span className="landing-feature__leak">+2:14 leak</span>
        </div>
        <div className="landing-feature__row">
          <span>Run pacing</span>
          <span className="landing-feature__strong">Strong</span>
        </div>
        <div className="landing-feature__row">
          <span>Station 4 — Sled push</span>
          <span className="landing-feature__leak">+0:41 leak</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Append their styles to `styles/_landing.scss`**

Add to the end of `styles/_landing.scss`:

```scss
.landing-section {
  padding: 64px 48px;
  border-top: 1px solid var(--line);
}

.landing-section__kicker {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
  margin: 0 0 8px;
}

.landing-section h2 {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 800;
  margin: 0 0 28px;
  color: var(--ink);
}

.landing-how__steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.landing-how__step {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 20px;
}

.landing-how__number {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--lime);
  margin-bottom: 10px;
}

.landing-how__step h3 {
  font-size: 1rem;
  margin: 0 0 8px;
  color: var(--ink);
}

.landing-how__step p {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.55;
  margin: 0;
}

.landing-feature {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: center;
}

.landing-feature__copy p {
  font-size: 0.9rem;
  color: var(--muted);
  line-height: 1.6;
  max-width: 28rem;
  margin: 0 0 18px;
}

.landing-feature__list {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.landing-feature__list li {
  font-size: 0.9rem;
  color: var(--ink);
  padding-left: 20px;
  position: relative;
}

.landing-feature__list li::before {
  content: "—";
  position: absolute;
  left: 0;
  color: var(--lime);
}

.landing-feature__preview {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 22px;
  position: relative;
}

.landing-feature__preview::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--lime);
  border-radius: 8px 8px 0 0;
}

.landing-feature__preview-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin-bottom: 16px;
}

.landing-feature__badge {
  background: var(--accent-soft);
  color: var(--ink);
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 700;
}

.landing-feature__score {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 16px;
}

.landing-feature__score-number {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 2.4rem;
  font-weight: 800;
  color: var(--ink);
}

.landing-feature__score-label {
  font-size: 0.75rem;
  color: var(--muted);
}

.landing-feature__row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  padding: 9px 0;
  border-top: 1px solid var(--line);
  color: var(--ink);
}

.landing-feature__leak {
  color: var(--red);
  font-weight: 700;
}

.landing-feature__strong {
  color: var(--teal);
  font-weight: 700;
}

@media (max-width: 760px) {
  .landing-section {
    padding: 40px 24px;
  }

  .landing-how__steps,
  .landing-feature {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/landing/LandingHowItWorks.tsx components/landing/LandingFeatureHighlight.tsx styles/_landing.scss
git commit -m "feat: add landing page how-it-works and feature-highlight sections"
```

---

### Task 5: Footer CTA, page composition, and stylesheet wiring

**Files:**
- Create: `components/landing/LandingFooterCta.tsx`
- Create: `app/page.tsx` (new landing page — the old one was moved in Task 1)
- Modify: `styles/_landing.scss`
- Modify: `app/globals.scss`

- [ ] **Step 1: Create the footer CTA component**

Create `components/landing/LandingFooterCta.tsx`:

```tsx
import Link from "next/link";

export function LandingFooterCta() {
  return (
    <section className="landing-footer-cta">
      <h2>Your next race starts with your last one.</h2>
      <p>Free to build. No card required.</p>
      <Link className="btn btn--primary btn--lg" href="/app?auth=signup">
        Build my free report
      </Link>
    </section>
  );
}
```

- [ ] **Step 2: Create the new landing page**

Create `app/page.tsx`:

```tsx
import Link from "next/link";
import { OchtShield } from "@/components/OchtShield";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingFeatureHighlight } from "@/components/landing/LandingFeatureHighlight";
import { LandingFooterCta } from "@/components/landing/LandingFooterCta";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link className="landing-header__brand" href="/">
          <OchtShield className="landing-header__shield" size={22} />
          <span className="landing-header__wordmark">
            ocht<em>.</em>
          </span>
        </Link>
        <nav className="landing-header__actions" aria-label="Account">
          <Link href="/app?auth=login">Log in</Link>
          <Link className="btn btn--primary btn--sm" href="/app?auth=signup">
            Sign up free
          </Link>
        </nav>
      </header>

      <LandingHero />
      <LandingHowItWorks />
      <LandingFeatureHighlight />
      <LandingFooterCta />
    </main>
  );
}
```

- [ ] **Step 3: Append the header and footer-CTA styles to `styles/_landing.scss`**

Add to the end of `styles/_landing.scss`:

```scss
.landing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 48px;
}

.landing-header__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--ink);
  text-decoration: none;
}

.landing-header__wordmark em {
  color: var(--lime);
  font-style: normal;
}

.landing-header__actions {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.85rem;
}

.landing-header__actions a:not(.btn) {
  color: var(--ink);
  text-decoration: none;
  opacity: 0.75;
}

.landing-footer-cta {
  text-align: center;
  padding: 72px 48px;
  background: radial-gradient(
    ellipse 80% 100% at 50% 100%,
    var(--accent-soft),
    transparent 70%
  );
}

.landing-footer-cta h2 {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  font-weight: 800;
  color: var(--ink);
  margin: 0 0 10px;
}

.landing-footer-cta p {
  font-size: 0.9rem;
  color: var(--muted);
  margin: 0 0 24px;
}

@media (max-width: 760px) {
  .landing-header {
    padding: 16px 24px;
  }

  .landing-footer-cta {
    padding: 48px 24px;
  }
}
```

- [ ] **Step 4: Wire the new partial into the global stylesheet**

In `app/globals.scss`, add a new line after the existing `@use "../styles/events";` (the last line in the file):

```scss
@use "../styles/landing";
```

- [ ] **Step 5: Verify**

Run: `npm run test`
Expected: all suites pass.

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds, and the route list in the build output includes both `/` and `/app`.

- [ ] **Step 6: Commit**

```bash
git add components/landing/LandingFooterCta.tsx app/page.tsx styles/_landing.scss app/globals.scss
git commit -m "feat: compose the landing page and wire its stylesheet"
```

---

### Task 6: Manual verification

No new automated tests here — this is the visual/behavioral pass the earlier tasks deferred (this codebase deliberately doesn't unit-test presentational components; see `lib/preferences.test.ts` and `lib/analysis.test.ts` for where the real logic coverage lives instead).

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://127.0.0.1:3002`.

- [ ] **Step 2: Check the logged-out landing page**

Visit `http://127.0.0.1:3002/` in a browser with no `ocht_session` cookie set.
Expected: the new landing page renders — header, hero (photo panel + headline + two CTAs), how-it-works, feature highlight, footer CTA band, then the existing global `SiteFooter` below it.

- [ ] **Step 3: Check the sample-report CTA**

Click "See a sample report" (or "Try it with sample data").
Expected: navigates to `/app`, the sample race data loads automatically (same data `DemoModal`'s "Load sample race" uses), a report is visible, and the URL no longer shows `?sample=1` after load.

- [ ] **Step 4: Check the sign-up CTA**

Click "Sign up free" (or "Build my free report").
Expected: navigates to `/app`, the sign-up form is already open (no extra click needed), and the URL no longer shows `?auth=signup` after load.

- [ ] **Step 5: Check the logged-in redirect**

Log in (or sign up) from the opened form. Then manually navigate back to `http://127.0.0.1:3002/`.
Expected: immediately redirected to `/app` — the landing page never renders for a logged-in session.

- [ ] **Step 6: Check theming**

On the landing page (log out again first), toggle the app's light/dark theme switch (in the `/app` account menu, then navigate back to `/`).
Expected: the how-it-works, feature-highlight, and footer-CTA sections switch colors with the theme; the hero band stays a fixed dark panel in both themes.

- [ ] **Step 7: Check mobile width**

Resize the browser to ~375px wide (or use device emulation) on the landing page.
Expected: hero stacks (text above, photo strip below with a bottom fade instead of a side fade), how-it-works steps and the feature-highlight columns stack to a single column.

- [ ] **Step 8: Final full verification**

Run: `npm run test`
Run: `npm run lint`
Run: `npm run build`
Expected: all green.

No commit for this task — it's verification only. If any step surfaces a bug, fix it in the relevant earlier task's files and commit the fix with a `fix:` message before continuing.
