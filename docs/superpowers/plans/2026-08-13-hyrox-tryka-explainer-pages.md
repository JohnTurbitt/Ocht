# HYROX & TRYKA Explainer Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/what-is-hyrox` and `/what-is-tryka`, two SEO-focused explainer pages targeting "what is hyrox" / "what is tryka" search queries, and fix the technical SEO bugs (canonical inheritance, indexable auth pages, SVG share image) found in the prior audit.

**Architecture:** Two new App Router pages sharing three small presentational components (`FormatHero`, `FormatQuickFacts`, `FormatStationGrid`) and one new SCSS partial (`_hybrid-racing.scss`). Station and distance data is read from the existing `lib/raceFormats.ts` / `lib/units.ts` so the pages can't drift from what the app actually implements. Sitewide metadata fixes (canonical tags, `/app` + `/settings` noindex, PNG share image, homepage JSON-LD) are bundled in as small, independent tasks.

**Tech Stack:** Next.js 15 App Router, TypeScript, SCSS, `sharp` (already present as a transitive dependency, used only for a one-off local asset-prep script — not added to `package.json`).

**Full spec:** `docs/superpowers/specs/2026-08-13-hyrox-tryka-explainer-pages-design.md`

---

### Task 1: Shared styles — `_hybrid-racing.scss`

**Files:**
- Create: `styles/_hybrid-racing.scss`
- Modify: `app/globals.scss:19` (add the new `@use` line after `@use "../styles/landing";`)

- [ ] **Step 1: Create the SCSS partial**

```scss
// styles/_hybrid-racing.scss
// Shared layout for the HYROX/TRYKA SEO explainer pages. Mirrors the
// landing-page hero pattern (fixed dark hero band, themed sections below)
// so these pages feel like the same site, not a bolted-on blog.

.format-page {
  background: var(--paper);
}

.format-hero {
  display: grid;
  grid-template-columns: 1fr 42%;
  min-height: 380px;
  background: #08100d;
  color: #f4f7ef;
  overflow: hidden;
}

.format-hero__text {
  padding: 56px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.format-hero__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--lime);
  font-weight: 600;
  margin: 0 0 12px;
}

.format-hero__text h1 {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 2.75rem);
  line-height: 1.05;
  font-weight: 800;
  margin: 0 0 16px;
}

.format-hero__dek {
  font-size: 1rem;
  color: rgba(244, 247, 239, 0.75);
  max-width: 32rem;
  margin: 0 0 28px;
}

.format-hero__photo {
  position: relative;
  background-image:
    linear-gradient(90deg, #08100d 0%, rgba(8, 16, 13, 0) 45%),
    var(--format-hero-photo);
  background-size: cover;
  background-position: 50% 30%;
}

.format-quick-facts {
  display: flex;
  gap: 32px;
  list-style: none;
  margin: 0;
  padding: 28px 48px;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}

.format-quick-facts li {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.format-quick-facts__value {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--ink);
}

.format-quick-facts__label {
  font-size: 0.75rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.format-body {
  padding: 48px;
  max-width: 44rem;
  margin: 0 auto;
}

.format-body h2 {
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 2.6vw, 1.8rem);
  font-weight: 800;
  color: var(--ink);
  margin: 0 0 16px;
}

.format-body h3 {
  font-size: 1rem;
  color: var(--ink);
  margin: 20px 0 6px;
}

.format-body p {
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--muted);
  margin: 0 0 16px;
}

.format-body p:last-child {
  margin-bottom: 0;
}

.format-body--callout {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  max-width: 52rem;
}

.format-station-grid {
  padding: 48px;
  max-width: 52rem;
  margin: 0 auto;
}

.format-station-grid h2 {
  font-family: var(--font-display);
  font-size: clamp(1.4rem, 2.6vw, 1.8rem);
  font-weight: 800;
  color: var(--ink);
  margin: 0 0 24px;
}

.format-station-grid__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.format-station-grid__item {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 18px;
}

.format-station-grid__index {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--lime);
}

.format-station-grid__item h3 {
  font-size: 0.95rem;
  color: var(--ink);
  margin: 8px 0 6px;
}

.format-station-grid__item p {
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.5;
  margin: 0;
}

@media (max-width: 760px) {
  .format-hero {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .format-hero__text {
    padding: 36px 24px;
  }

  .format-hero__photo {
    height: 200px;
    background-image:
      linear-gradient(180deg, rgba(8, 16, 13, 0) 40%, #08100d 100%),
      var(--format-hero-photo);
  }

  .format-quick-facts,
  .format-body,
  .format-station-grid {
    padding: 32px 24px;
  }

  .format-station-grid__grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Register the partial in `app/globals.scss`**

Add this line after `@use "../styles/landing";` (line 19):

```scss
@use "../styles/hybrid-racing";
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, no SCSS errors (there's no route using these classes yet, so this only proves the partial parses cleanly).

- [ ] **Step 4: Commit**

```bash
git add styles/_hybrid-racing.scss app/globals.scss
git commit -m "Add shared styles for HYROX/TRYKA explainer pages"
```

---

### Task 2: Shared components

**Files:**
- Create: `components/hybrid-racing/FormatHero.tsx`
- Create: `components/hybrid-racing/FormatQuickFacts.tsx`
- Create: `components/hybrid-racing/FormatStationGrid.tsx`

- [ ] **Step 1: Create `FormatHero.tsx`**

```tsx
import type { CSSProperties } from "react";
import Link from "next/link";

type FormatHeroProps = {
  eyebrow: string;
  title: string;
  dek: string;
  photoSrc: string;
  photoAlt: string;
  ctaHref: string;
  ctaLabel: string;
};

export function FormatHero({
  eyebrow,
  title,
  dek,
  photoSrc,
  photoAlt,
  ctaHref,
  ctaLabel,
}: FormatHeroProps) {
  const photoStyle = {
    "--format-hero-photo": `url(${photoSrc})`,
  } as CSSProperties;

  return (
    <section className="format-hero">
      <div className="format-hero__text">
        <p className="format-hero__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="format-hero__dek">{dek}</p>
        <Link className="btn btn--primary btn--lg" href={ctaHref}>
          {ctaLabel}
        </Link>
      </div>
      <div
        className="format-hero__photo"
        role="img"
        aria-label={photoAlt}
        style={photoStyle}
      />
    </section>
  );
}
```

- [ ] **Step 2: Create `FormatQuickFacts.tsx`**

```tsx
type QuickFact = {
  label: string;
  value: string;
};

type FormatQuickFactsProps = {
  facts: QuickFact[];
};

export function FormatQuickFacts({ facts }: FormatQuickFactsProps) {
  return (
    <ul className="format-quick-facts">
      {facts.map((fact) => (
        <li key={fact.label}>
          <span className="format-quick-facts__value">{fact.value}</span>
          <span className="format-quick-facts__label">{fact.label}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Create `FormatStationGrid.tsx`**

```tsx
type FormatStation = {
  label: string;
  description: string;
};

type FormatStationGridProps = {
  heading: string;
  stations: FormatStation[];
};

export function FormatStationGrid({ heading, stations }: FormatStationGridProps) {
  return (
    <section className="format-station-grid">
      <h2>{heading}</h2>
      <div className="format-station-grid__grid">
        {stations.map((station, index) => (
          <div className="format-station-grid__item" key={station.label}>
            <span className="format-station-grid__index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3>{station.label}</h3>
            <p>{station.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Verify types check**

Run: `npx tsc --noEmit`
Expected: no new errors (these components aren't imported anywhere yet, but this catches syntax/type mistakes early).

- [ ] **Step 5: Commit**

```bash
git add components/hybrid-racing/
git commit -m "Add shared FormatHero/FormatQuickFacts/FormatStationGrid components"
```

---

### Task 3: Prepare image assets (hero photos + PNG share image)

**Files:**
- Create (temporary, deleted before commit): `tmp-asset-prep.mjs` at repo root
- Create: `public/hybrid-racing/hyrox-hero.jpg`
- Create: `public/hybrid-racing/tryka-hero.jpg`
- Create: `public/og-image.png`

Source photos are real HYROX Madrid event photography the user supplied in `campaigns/Photo/`. Per the design spec, the visible HYROX branding in these photos is **not** to be altered — only resized/compressed for web delivery, nothing composited on top of the image files themselves.

- [ ] **Step 1: Confirm `sharp` is resolvable**

Run: `node -e "console.log(require.resolve('sharp'))"`
Expected: prints a path inside `node_modules/sharp/...`. If this fails with `Cannot find module 'sharp'`, run `npm install --no-save sharp` first, then retry.

- [ ] **Step 2: Write the temporary asset-prep script**

Create `tmp-asset-prep.mjs` at the repo root (must live inside the project tree so Node's module resolution can find `node_modules/sharp`):

```js
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public/hybrid-racing", { recursive: true });

await sharp("campaigns/Photo/16146_20251129_075734_596861998_original.jpg")
  .resize({ width: 1920 })
  .jpeg({ quality: 78 })
  .toFile("public/hybrid-racing/hyrox-hero.jpg");

await sharp("campaigns/Photo/16146_20251129_080317_596826207_original.jpg")
  .resize({ width: 1920 })
  .jpeg({ quality: 78 })
  .toFile("public/hybrid-racing/tryka-hero.jpg");

await sharp("public/og-image.svg")
  .resize(1200, 630)
  .png()
  .toFile("public/og-image.png");

console.log("done");
```

- [ ] **Step 3: Run it**

Run: `node tmp-asset-prep.mjs`
Expected: prints `done`, no errors.

- [ ] **Step 4: Verify the output files**

Run: `ls -la public/hybrid-racing/ public/og-image.png`
Expected: `hyrox-hero.jpg`, `tryka-hero.jpg` (each well under the ~1-3MB originals after compression), and `og-image.png` (1200×630).

- [ ] **Step 5: Delete the temporary script**

```bash
rm tmp-asset-prep.mjs
```

- [ ] **Step 6: Commit the new assets**

```bash
git add public/hybrid-racing/ public/og-image.png
git commit -m "Add optimized hero photos and PNG share image"
```

---

### Task 4: Sitewide fix — explicit canonical on the 5 static pages

**Problem (from the SEO audit):** `app/layout.tsx` sets `alternates: { canonical: "/" }` on the root layout. Next.js metadata merges top-down per key, so any page that doesn't declare its own `alternates` inherits `"/"` — meaning `/calculations`, `/contact`, `/privacy`, `/refunds`, and `/terms` currently all self-declare the homepage as their canonical URL, telling Google not to index them separately.

**Files:**
- Modify: `app/calculations/page.tsx:4-8`
- Modify: `app/contact/page.tsx:4-7`
- Modify: `app/privacy/page.tsx:4-7`
- Modify: `app/refunds/page.tsx:4-7`
- Modify: `app/terms/page.tsx:4-7`

- [ ] **Step 1: Fix `app/calculations/page.tsx`**

```tsx
export const metadata: Metadata = {
  title: "Calculation Method - Ocht",
  description:
    "How Ocht calculates race splits, time leaks, target gaps and training priorities.",
  alternates: { canonical: "/calculations" },
};
```

- [ ] **Step 2: Fix `app/contact/page.tsx`**

```tsx
export const metadata: Metadata = {
  title: "Contact - Ocht",
  description: "Contact Ocht for support, billing and account requests.",
  alternates: { canonical: "/contact" },
};
```

- [ ] **Step 3: Fix `app/privacy/page.tsx`**

```tsx
export const metadata: Metadata = {
  title: "Privacy Policy - Ocht",
  description: "How Ocht handles account, billing and race report data.",
  alternates: { canonical: "/privacy" },
};
```

- [ ] **Step 4: Fix `app/refunds/page.tsx`**

```tsx
export const metadata: Metadata = {
  title: "Refunds and Cancellation - Ocht",
  description: "How Ocht subscriptions, cancellation and refund requests work.",
  alternates: { canonical: "/refunds" },
};
```

- [ ] **Step 5: Fix `app/terms/page.tsx`**

```tsx
export const metadata: Metadata = {
  title: "Terms of Service - Ocht",
  description: "Terms for using Ocht race analytics and paid reports.",
  alternates: { canonical: "/terms" },
};
```

- [ ] **Step 6: Verify each page's rendered canonical tag**

Run: `npm run dev` (in one terminal), then in another:
```bash
curl -s http://127.0.0.1:3002/calculations | grep -o '<link rel="canonical"[^>]*>'
curl -s http://127.0.0.1:3002/contact | grep -o '<link rel="canonical"[^>]*>'
```
Expected: each prints its own path (`/calculations`, `/contact`), not `/`. Stop the dev server after checking.

- [ ] **Step 7: Commit**

```bash
git add app/calculations/page.tsx app/contact/page.tsx app/privacy/page.tsx app/refunds/page.tsx app/terms/page.tsx
git commit -m "Fix canonical tag inheritance bug on static pages"
```

---

### Task 5: Sitewide fix — noindex `/app` and `/settings`

**Problem (from the SEO audit):** `app/app/page.tsx` and `app/settings/page.tsx` are `"use client"` components with no metadata export and no `layout.tsx`, so both inherit the root layout's `robots: { index: true, follow: true }` and the homepage's title/description. `/settings` is a signed-in account page that should never be indexed; `/app` currently creates a duplicate-title collision with `/`. `app/robots.ts` only disallows `/api/` and `/admin`, so crawlers can reach both freely.

**Files:**
- Create: `app/app/layout.tsx`
- Create: `app/settings/layout.tsx`
- Modify: `app/robots.ts:10`

- [ ] **Step 1: Create `app/app/layout.tsx`**

Client components can't export `metadata` directly — a sibling server-component `layout.tsx` is the standard way to attach metadata to a client-component route segment.

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 2: Create `app/settings/layout.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function SettingsRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 3: Add `/settings` to `app/robots.ts`**

Change line 10 from:
```ts
      disallow: ["/api/", "/admin"],
```
to:
```ts
      disallow: ["/api/", "/admin", "/settings"],
```

`/app` is intentionally left crawlable in `robots.ts` (it's still the signup/login entry point), but is now `noindex` via its own layout so it won't appear in search results with the duplicate homepage title.

- [ ] **Step 4: Verify**

Run: `npm run dev`, then:
```bash
curl -s http://127.0.0.1:3002/settings | grep -o '<meta name="robots"[^>]*>'
curl -s http://127.0.0.1:3002/app | grep -o '<meta name="robots"[^>]*>'
```
Expected: both print `content="noindex, nofollow"`. Stop the dev server after checking.

- [ ] **Step 5: Commit**

```bash
git add app/app/layout.tsx app/settings/layout.tsx app/robots.ts
git commit -m "Noindex the signed-in app shell and settings page"
```

---

### Task 6: Sitewide fix — PNG share image + homepage structured data

**Files:**
- Modify: `app/layout.tsx:71` and `app/layout.tsx:82`
- Modify: `app/page.tsx`

- [ ] **Step 1: Swap the OG/Twitter image from SVG to PNG**

In `app/layout.tsx`, the `openGraph.images` block (around line 69-76) currently reads:

```tsx
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Ocht hybrid race split analyzer preview",
      },
    ],
```

Change `url: "/og-image.svg"` to `url: "/og-image.png"`.

And the `twitter.images` line (around line 82):

```tsx
    images: ["/og-image.svg"],
```

Change to:

```tsx
    images: ["/og-image.png"],
```

(The `public/og-image.png` file was generated in Task 3. The dimensions and `summary_large_image` card type were already correct — only the file format was the problem, since Facebook/LinkedIn/X don't reliably render SVG for link-preview cards.)

- [ ] **Step 2: Add `SoftwareApplication` JSON-LD to the homepage**

In `app/page.tsx`, add the JSON-LD object above the component and render it inside `<main>`:

```tsx
import Link from "next/link";
import { OchtShield } from "@/components/OchtShield";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingFeatureHighlight } from "@/components/landing/LandingFeatureHighlight";
import { LandingFooterCta } from "@/components/landing/LandingFooterCta";

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ocht",
  applicationCategory: "SportsApplication",
  operatingSystem: "Web",
  description:
    "Trace hybrid race splits, find time leaks and build a realistic next target.",
};

export default function LandingPage() {
  return (
    <main className="landing-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd),
        }}
      />
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

- [ ] **Step 3: Verify**

Run: `npm run dev`, then:
```bash
curl -s http://127.0.0.1:3002/ | grep -o '<meta property="og:image"[^>]*>'
curl -s http://127.0.0.1:3002/ | grep -o 'application/ld+json'
```
Expected: first command shows `og-image.png`; second command finds at least one match. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "Fix SVG share image and add homepage structured data"
```

---

### Task 7: `/what-is-hyrox` page

**Files:**
- Create: `app/what-is-hyrox/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { OchtShield } from "@/components/OchtShield";
import { LandingFooterCta } from "@/components/landing/LandingFooterCta";
import { FormatHero } from "@/components/hybrid-racing/FormatHero";
import { FormatQuickFacts } from "@/components/hybrid-racing/FormatQuickFacts";
import { FormatStationGrid } from "@/components/hybrid-racing/FormatStationGrid";
import { getRaceFormatOption } from "@/lib/raceFormats";
import { getTotalRunDistance } from "@/lib/units";

const format = getRaceFormatOption("hyrox");
const totalRunKm = getTotalRunDistance(8, "hyrox", "km");

const pageDescription =
  "HYROX explained: the 8km run, 8-station format, fixed station order, and how it compares to TRYKA. A plain guide for first-time racers.";

export const metadata: Metadata = {
  title: "What Is HYROX?",
  description: pageDescription,
  alternates: { canonical: "/what-is-hyrox" },
  openGraph: {
    type: "article",
    url: "/what-is-hyrox",
    title: "What Is HYROX? - Ocht",
    description: pageDescription,
    images: [
      {
        url: "/hybrid-racing/hyrox-hero.jpg",
        width: 1200,
        height: 630,
        alt: "Competitor walking through a HYROX race floor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "What Is HYROX? - Ocht",
    description: pageDescription,
    images: ["/hybrid-racing/hyrox-hero.jpg"],
  },
};

const stationDescriptions: Record<string, string> = {
  ski: "1,000m on the SkiErg to open the race — the first check on pacing discipline.",
  sledPush: "50m sled push at heavy load. Short, brutal, over quickly.",
  sledPull: "50m sled pull, hand over hand on a rope.",
  burpees: "80m of burpee broad jumps — the station most people dread.",
  row: "1,000m on the rowing ergometer.",
  farmers: "200m farmers carry with two loaded kettlebells.",
  lunges: "100m of walking lunges carrying a sandbag.",
  wallBalls: "The final station — repeated wall ball shots before the finish line.",
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "What Is HYROX?",
  description: pageDescription,
  publisher: {
    "@type": "Organization",
    name: "Ocht",
  },
};

export default function WhatIsHyroxPage() {
  return (
    <main className="format-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
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

      <FormatHero
        eyebrow="Race format guide"
        title="What is HYROX?"
        dek="8km of running, 8 functional stations, one fixed order, the same course worldwide. Here's what a HYROX race actually involves."
        photoSrc="/hybrid-racing/hyrox-hero.jpg"
        photoAlt="Competitor walking through a HYROX race floor with 'Last reps!' screens overhead"
        ctaHref="/app?auth=signup"
        ctaLabel="Build my free HYROX report"
      />

      <FormatQuickFacts
        facts={[
          { value: `${totalRunKm}km`, label: "Total running" },
          { value: "8", label: "Stations" },
          { value: "Fixed", label: "Station order" },
        ]}
      />

      <section className="format-body">
        <h2>How a HYROX race works</h2>
        <p>
          HYROX bills itself as the World Series of Fitness Racing, and the
          format is built to make that claim testable: every event, in every
          city, runs the exact same course. A HYROX race alternates 8
          one-kilometre runs with 8 functional-fitness stations, always in the
          same order — run, station, run, station — until the wall ball
          station closes the race out. There's no course variation to argue
          about between venues, which is why times are directly comparable
          from one HYROX to the next.
        </p>
        <p>
          Racers move through the roxzone — the section of the floor where
          the stations sit — carrying their own timing chip, so the clock
          never stops between a run leg and a station. That transition time
          is part of the race, not a break from it, which is a big part of
          why pacing the runs correctly matters as much as station strength.
        </p>
      </section>

      <FormatStationGrid
        heading="The 8 HYROX stations"
        stations={format.stations.map((station) => ({
          label: station.label,
          description: stationDescriptions[station.key] ?? station.guidance,
        }))}
      />

      <section className="format-body format-body--callout">
        <h2>HYROX vs TRYKA</h2>
        <p>
          Ocht also supports <Link href="/what-is-tryka">TRYKA</Link>, a
          newer hybrid-race series with shorter run legs (500m or 800m
          instead of 1km) and a different station lineup. The two formats
          reward slightly different athletes — see the TRYKA guide for how
          it compares.
        </p>
      </section>

      <section className="format-body">
        <h2>Who HYROX is for</h2>
        <p>
          HYROX races across an Open, Pro, and Doubles/Relay structure, so
          the same event floor holds first-timers and competitive athletes
          at once. Most people finish comfortably inside the cutoffs without
          being elite runners or elite lifters — the format rewards being
          reasonably competent at both over being exceptional at either. If
          you can run 8km total at a controlled pace and handle moderate
          loads under fatigue, you can finish one.
        </p>
      </section>

      <section className="format-body">
        <h2>Training for HYROX</h2>
        <p>
          The two most common limiters aren't raw fitness — they're pacing
          the runs too aggressively early, and losing time in the
          transitions into and out of stations. Training that blends
          continuous running with station-specific strength-endurance work,
          practised in the same alternating pattern as race day, tends to
          transfer better than pure running or pure strength training done
          separately. Ocht's report breaks your splits down station by
          station and run by run, so you can see exactly which one is
          costing you the most time.
        </p>
      </section>

      <section className="format-body">
        <h2>Frequently asked questions</h2>
        <h3>How long does a HYROX race take?</h3>
        <p>
          It varies hugely by division and fitness level — the format is
          built to be finishable by a wide range of athletes, not just
          elite competitors.
        </p>
        <h3>Do I need to be a strong runner to do HYROX?</h3>
        <p>
          No. Running fitness matters, but so does station strength and
          transition speed — HYROX rewards being well-rounded over being
          fast in one discipline.
        </p>
        <h3>Is HYROX the same at every event?</h3>
        <p>
          Yes — the run distance, station order, and station format are
          fixed worldwide, which is what makes times comparable between
          venues.
        </p>
      </section>

      <LandingFooterCta />
    </main>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `http://127.0.0.1:3002/what-is-hyrox`.
Expected: hero photo renders with the gradient/logo overlay, quick facts show `8km / 8 / Fixed`, all 8 stations render in the grid, page scrolls through all prose sections, footer CTA links to `/app?auth=signup`. Check both light and dark theme (the theme toggle lives wherever the rest of the site exposes it — confirm via `localStorage.setItem("ocht.theme", "dark")` + reload if there's no visible toggle on this page). Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add app/what-is-hyrox/
git commit -m "Add /what-is-hyrox explainer page"
```

---

### Task 8: `/what-is-tryka` page

**Files:**
- Create: `app/what-is-tryka/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { OchtShield } from "@/components/OchtShield";
import { LandingFooterCta } from "@/components/landing/LandingFooterCta";
import { FormatHero } from "@/components/hybrid-racing/FormatHero";
import { FormatQuickFacts } from "@/components/hybrid-racing/FormatQuickFacts";
import { FormatStationGrid } from "@/components/hybrid-racing/FormatStationGrid";
import { getRaceFormatOption } from "@/lib/raceFormats";
import { getTotalRunDistance } from "@/lib/units";

const format = getRaceFormatOption("tryka800");
const totalRunKm = getTotalRunDistance(8, "tryka800", "km");

const pageDescription =
  "TRYKA explained: the 800m/500m run format, 8 stations, and how it compares to HYROX. A plain guide for first-time racers.";

export const metadata: Metadata = {
  title: "What Is TRYKA?",
  description: pageDescription,
  alternates: { canonical: "/what-is-tryka" },
  openGraph: {
    type: "article",
    url: "/what-is-tryka",
    title: "What Is TRYKA? - Ocht",
    description: pageDescription,
    images: [
      {
        url: "/hybrid-racing/tryka-hero.jpg",
        width: 1200,
        height: 630,
        alt: "Hybrid-race event floor with rowing ergs set up in rows",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "What Is TRYKA? - Ocht",
    description: pageDescription,
    images: ["/hybrid-racing/tryka-hero.jpg"],
  },
};

const stationDescriptions: Record<string, string> = {
  ski: "1,000m on the SkiErg to open the race, same opening station as HYROX.",
  sledPush: "200m farmers carry with two loaded kettlebells.",
  sledPull: "60 reps of ram thrusters.",
  burpees: "50m sled push at heavy load.",
  row: "50m sled pull, hand over hand on a rope.",
  farmers: "1,000m on the rowing ergometer.",
  lunges: "100m of walking lunges carrying a sandbag.",
  wallBalls: "80m of burpee broad jumps before the finish.",
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "What Is TRYKA?",
  description: pageDescription,
  publisher: {
    "@type": "Organization",
    name: "Ocht",
  },
};

export default function WhatIsTrykaPage() {
  return (
    <main className="format-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
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

      <FormatHero
        eyebrow="Race format guide"
        title="What is TRYKA?"
        dek="Shorter run legs, 8 stations, the same run-station-run structure as HYROX. Here's what sets a TRYKA race apart."
        photoSrc="/hybrid-racing/tryka-hero.jpg"
        photoAlt="Rows of rowing ergometers set up on a hybrid-race event floor"
        ctaHref="/app?auth=signup"
        ctaLabel="Build my free TRYKA report"
      />

      <FormatQuickFacts
        facts={[
          { value: `${totalRunKm}km`, label: "Total running (800 distance)" },
          { value: "8", label: "Stations" },
          { value: "500/800", label: "Distance options" },
        ]}
      />

      <section className="format-body">
        <h2>How a TRYKA race works</h2>
        <p>
          TRYKA follows the same basic shape as HYROX — 8 runs alternating
          with 8 functional-fitness stations, timing chip running
          continuously through the transitions — but shortens the run legs.
          TRYKA races come in two distances: TRYKA 800, with 8 runs of 800m
          each, and TRYKA 500, with 8 runs of 500m each. Total running comes
          to {getTotalRunDistance(8, "tryka800", "km")}km or{" "}
          {getTotalRunDistance(8, "tryka500", "km")}km depending on which
          distance you enter, against HYROX's 8km.
        </p>
        <p>
          The station lineup is also different from HYROX — TRYKA reorders
          and relabels several of the movements (a longer SkiErg opener,
          rowing and sled work later in the race) rather than reusing
          HYROX's exact station order. TRYKA events currently run in Ireland,
          the UK, and Portugal, including RDS Dublin, London, and Lisbon.
        </p>
      </section>

      <FormatStationGrid
        heading="The 8 TRYKA stations (800 distance)"
        stations={format.stations.map((station) => ({
          label: station.label,
          description: stationDescriptions[station.key] ?? station.guidance,
        }))}
      />

      <section className="format-body format-body--callout">
        <h2>TRYKA vs HYROX</h2>
        <p>
          Ocht also supports <Link href="/what-is-hyrox">HYROX</Link>, the
          longer-running, more established hybrid-race format. If you're
          deciding which to try first, TRYKA's shorter run legs put
          relatively more weight on the stations and transitions; HYROX's
          full 1km legs put more weight on sustained running pace. See the
          HYROX guide for the full comparison.
        </p>
      </section>

      <section className="format-body">
        <h2>Who TRYKA is for</h2>
        <p>
          TRYKA's shorter run legs make it a reasonable first hybrid race
          for athletes coming from a strength or CrossFit-style background
          rather than a running background, since less of the race is spent
          on sustained aerobic running. It's also a good fit if you've
          already done HYROX and want to see how a different run-to-station
          ratio changes your pacing decisions.
        </p>
      </section>

      <section className="format-body">
        <h2>Training for TRYKA</h2>
        <p>
          Because the run legs are shorter, transitions make up a larger
          share of total race time than in HYROX — practising fast entries
          and exits at each station matters more here, not less. Interval
          work at race-leg distance (500m or 800m repeats) paired with the
          specific TRYKA station movements, done back-to-back rather than in
          isolation, is the closest training analogue to what the race
          actually demands.
        </p>
      </section>

      <section className="format-body">
        <h2>Frequently asked questions</h2>
        <h3>What's the difference between TRYKA 500 and TRYKA 800?</h3>
        <p>
          The run leg distance — 500m or 800m per leg, 8 legs total either
          way. Everything else about the format stays the same.
        </p>
        <h3>Is TRYKA easier than HYROX?</h3>
        <p>
          Not necessarily easier — just different. Less total running means
          more of the race is decided at the stations and in transitions.
        </p>
        <h3>Where are TRYKA races held?</h3>
        <p>
          Current events include RDS Dublin (Ireland), London (UK), and
          Lisbon (Portugal).
        </p>
      </section>

      <LandingFooterCta />
    </main>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `http://127.0.0.1:3002/what-is-tryka`.
Expected: hero photo renders with the gradient/logo overlay, quick facts show `6.4km / 8 / 500/800`, all 8 TRYKA stations render with their TRYKA-specific labels (not HYROX labels), cross-link to `/what-is-hyrox` works, footer CTA links to `/app?auth=signup`. Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add app/what-is-tryka/
git commit -m "Add /what-is-tryka explainer page"
```

---

### Task 9: Add both pages to the sitemap

**Files:**
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Update `app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ocht.app";

const staticRoutes = [
  "",
  "/calculations",
  "/contact",
  "/privacy",
  "/refunds",
  "/terms",
  "/what-is-hyrox",
  "/what-is-tryka",
];

const formatGuideRoutes = new Set(["/what-is-hyrox", "/what-is-tryka"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return staticRoutes.map((route) => {
    const isHome = route === "";
    const isFormatGuide = formatGuideRoutes.has(route);

    return {
      url: `${appUrl}${route}`,
      lastModified,
      changeFrequency: isHome ? "weekly" : "monthly",
      priority: isHome ? 1 : isFormatGuide ? 0.6 : 0.5,
    };
  });
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev`, then:
```bash
curl -s http://127.0.0.1:3002/sitemap.xml | grep -o '<loc>[^<]*</loc>'
```
Expected: 8 URLs listed, including `https://ocht.app/what-is-hyrox` and `https://ocht.app/what-is-tryka` (or the `NEXT_PUBLIC_APP_URL` value if set locally). Stop the dev server after checking.

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "Add HYROX/TRYKA explainer pages to sitemap"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass (this change doesn't touch any tested `lib/` logic — `getRaceFormatOption` and `getTotalRunDistance` are consumed read-only — so this is a regression check, not new coverage).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds, `/what-is-hyrox` and `/what-is-tryka` appear in the route output as static pages.

- [ ] **Step 3: Manual browser pass**

Run: `npm run dev`, then in a browser:
1. Visit `/what-is-hyrox` and `/what-is-tryka` — confirm hero, quick facts, station grid, prose, cross-links, and footer CTA all render correctly in both light and dark theme.
2. Visit `/calculations`, `/contact`, `/privacy`, `/refunds`, `/terms` — confirm they still render unchanged (only metadata changed, not visible content).
3. View source on `/` — confirm `og:image` points to `/og-image.png` and a `SoftwareApplication` JSON-LD block is present.
4. Visit `/settings` and `/app` while logged out — confirm they still work for users, just check `view-source:` shows `<meta name="robots" content="noindex, nofollow">`.

Stop the dev server when done.

- [ ] **Step 4: Confirm no leftover temp files**

Run: `git status`
Expected: clean working tree (the `tmp-asset-prep.mjs` script from Task 3 was already deleted and never committed).

---

## Summary of new/changed files

**New:**
- `styles/_hybrid-racing.scss`
- `components/hybrid-racing/FormatHero.tsx`
- `components/hybrid-racing/FormatQuickFacts.tsx`
- `components/hybrid-racing/FormatStationGrid.tsx`
- `public/hybrid-racing/hyrox-hero.jpg`, `public/hybrid-racing/tryka-hero.jpg`
- `public/og-image.png`
- `app/app/layout.tsx`, `app/settings/layout.tsx`
- `app/what-is-hyrox/page.tsx`, `app/what-is-tryka/page.tsx`

**Modified:**
- `app/globals.scss`
- `app/calculations/page.tsx`, `app/contact/page.tsx`, `app/privacy/page.tsx`, `app/refunds/page.tsx`, `app/terms/page.tsx`
- `app/robots.ts`
- `app/layout.tsx`, `app/page.tsx`
- `app/sitemap.ts`
