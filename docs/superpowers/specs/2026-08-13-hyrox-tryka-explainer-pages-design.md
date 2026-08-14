# HYROX & TRYKA Explainer Pages — Design Spec

**Date:** 2026-08-13
**Status:** Approved for planning

## Goal

Two standalone, top-of-funnel SEO pages targeting the search queries "what is hyrox" and "what is tryka". Purely for organic search acquisition — visitors who don't know Ocht yet, converting to signup. Not linked from the in-app product (format picker, records tab, etc.) — that's a separate, later decision if wanted.

Alongside this, fix the sitewide technical SEO issues found in the preceding audit (see "Sitewide SEO fixes" below), since the new pages should launch on a corrected metadata foundation, not compound the existing bugs.

## Pages

| Page | URL | Hero photo |
|---|---|---|
| HYROX explainer | `/what-is-hyrox` | `LAST REPS!` arena shot (wide venue, competitor walking, HYROX Madrid signage) |
| TRYKA explainer | `/what-is-tryka` | Thunderdome row shot (rowing ergs, HYROX Madrid signage) — captioned as illustrative hybrid-race imagery, **not** claimed as a TRYKA event |

Source photos: `campaigns/Photo/16146_20251129_075734_596861998_original.jpg` (HYROX hero) and `campaigns/Photo/16146_20251129_080317_596826207_original.jpg` (TRYKA hero), both real HYROX Madrid event photography supplied by the user. Both files need optimizing (resize + compress; originals are 1-3MB JPGs) and copying into `public/hybrid-racing/` as part of implementation.

**Important constraint carried from brainstorming:** the visible "HYROX" branding on equipment/venue signage in these photos must **not** be altered, covered, or replaced with Ocht branding — these are real photos of a real, trademarked event, and editing out HYROX's own marks (especially on the page that explains what HYROX is) would misrepresent the imagery. Ocht branding is applied only in page chrome: a CSS gradient scrim over the hero + the existing `OchtShield` logo in the page header, exactly like the current homepage hero (`components/landing/LandingHero.tsx`, `styles/_landing.scss:59-66`). The photo files themselves are used as-is.

## Layout — "magazine hero + station grid"

Both pages share one structural template (a new shared layout pattern, not the existing minimal `legal-page` style used by `/calculations` etc. — this is a richer, more visual page). Content and station data differ per page.

1. **Hero** — full-bleed photo, left-to-right gradient scrim (mirrors `.landing-hero__photo`), eyebrow + H1 + one-line dek + primary CTA button, overlaid on the photo.
2. **Quick-facts strip** — distance, station count, typical finish time, sourced from `lib/raceFormats.ts` (`getRaceFormatOption`) so the numbers can't drift from what the app actually implements. HYROX page reads the `hyrox` format; TRYKA page reads `tryka800` (the flagship TRYKA distance) with a note that `tryka500` also exists.
3. **Station grid** — 2-column grid of all 8 stations for that format, label + one-line description each, pulled from `raceFormatOptions`/`buildTrykaStations()`.
4. **Prose body**, ~600-900 words total, sections:
   - What the format looks like (race structure, run/station alternation)
   - How it compares to the other format (short comparison callout, links to the sibling page)
   - Who it's for (beginner/competitive framing, matches existing `Level` concept in `lib/analysis`)
   - Training notes (general guidance, not medical/coaching advice — mirrors the disclaimer tone already used on `/terms`)
   - FAQ (3-4 Q&As — only add `FAQPage` schema if the on-page FAQ content genuinely matches, per the SEO skill's anti-pattern guidance)
5. **Closing CTA band** — reuses the visual pattern of `LandingFooterCta`, "Build my free report" → `/app?auth=signup`.
6. **Cross-link** — one contextual link from the HYROX page to `/what-is-tryka` and vice versa ("Ocht also supports...").

## Data accuracy

All station names, counts, and distances must be pulled programmatically from `lib/raceFormats.ts`, not hand-typed into the page copy — this keeps the pages truthful if the app's format definitions ever change, and matches the SEO skill's "read the real page/data first" principle.

## Per-page SEO metadata

Each page exports its own `Metadata` (no reliance on root-layout inheritance):

- `title`: `"What Is HYROX? - Ocht"` / `"What Is TRYKA? - Ocht"` (using the existing `%s - Ocht` template)
- `description`: unique, 120-160 chars, honest summary
- `alternates.canonical`: `/what-is-hyrox` / `/what-is-tryka` respectively — **explicit**, not inherited (this is the fix for the canonical bug found in the audit)
- `openGraph`/`twitter`: page-specific title/description + the page's own hero photo as the share image
- JSON-LD `Article` schema (headline, description, publisher: Ocht)
- Added to `app/sitemap.ts` (`changeFrequency: "monthly"`, `priority: 0.6`)

## Sitewide SEO fixes (from the prior audit)

Bundled into this same body of work since the new pages should launch clean:

1. **Canonical bug** — `app/calculations/page.tsx`, `app/contact/page.tsx`, `app/privacy/page.tsx`, `app/refunds/page.tsx`, `app/terms/page.tsx` currently inherit `alternates.canonical: "/"` from the root layout because none declare their own. Add an explicit `alternates.canonical` to each.
2. **`/app` and `/settings` indexability** — both are client components with no metadata export and no `layout.tsx`, so they inherit the homepage's indexable, duplicate-title metadata. Add a `layout.tsx` to each route exporting `robots: { index: false, follow: false }`, and add `/settings` to the `disallow` list in `app/robots.ts`.
3. **OG/Twitter share image is SVG** — `app/layout.tsx` points `openGraph.images` and `twitter.images` at `/og-image.svg`. Facebook, LinkedIn, and X do not reliably render SVG for link-preview cards. Replace with a rendered 1200×630 PNG at `/og-image.png`, generated from the existing SVG (or a fresh raster export), and update `app/layout.tsx` accordingly. Twitter's `summary_large_image` card type and the OG image dimensions (1200×630) are already correct — only the file format needs fixing, not the shape of the metadata.
4. **Structured data** — add a `SoftwareApplication` JSON-LD block to the homepage (`app/page.tsx`), matching what Ocht actually is (free hybrid-race split analyzer). This is new, not a fix, but bundled here since it's the same "metadata correctness" pass.

Items 1-2 and 4 touch existing pages only — no visual changes, metadata/robots only. Item 3 needs a new PNG asset generated from the current brand SVG.

## Out of scope

- No TRYKA-specific photography (none supplied; using honestly-captioned HYROX venue imagery instead)
- No image-editing/compositing tooling — Ocht branding stays in page chrome (CSS overlay), never baked into or replacing HYROX's own marks in the photos
- No linking from the in-app product (format picker, records tab) to these pages
- No changes to `/calculations`, `/contact`, `/privacy`, `/refunds`, `/terms` beyond the canonical fix (copy/layout unchanged)
