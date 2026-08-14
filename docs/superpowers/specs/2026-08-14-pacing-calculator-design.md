# HYROX Pacing Calculator — Design Spec

**Date:** 2026-08-14
**Status:** Approved for planning

## Goal

Ocht's report today is a post-race diagnostic — it requires real run/station splits, so it only serves people who have already raced HYROX or TRYKA. Most first-time racers have nothing to enter. This adds a **predictor**: enter a target finish time and Ocht builds three realistic split-by-split pacing plans to get there, using existing per-station benchmark data. No prior race required.

It's a public, no-login page — doubling as a free SEO tool page (the growth direction agreed on earlier in this session) alongside `/what-is-hyrox` and `/what-is-tryka`, while also being usable by signed-in users.

## Page

**Route:** `/hyrox-pacing-calculator` (new). TRYKA is reachable via the same page's format picker rather than a separate route — one calculation engine, one page, per the mockup approved in brainstorming.

**Layout** (confirmed via HTML mockup, approved with two changes noted below):
1. Hero — eyebrow, H1, one-line dek, matching the `format-hero`/landing-header visual pattern already used on `/what-is-hyrox`.
2. Input controls — target finish time, athlete level, race format.
3. Three scenario tabs (Balanced / Run-focused / Station-focused), each rendering a split-by-split table (8 runs + 8 stations) summing to the target.
4. Closing CTA band — copy and link adapt to auth state (see below).

**Input controls — reuse existing components, do not build new ones:**
- **Format picker**: reuse `.format-picker`/`.format-card` markup pattern from `components/SplitForm.tsx:203-218`, driven by `raceFormatOptions` (`lib/raceFormats.ts`). **Exclude the "Custom" option** — custom station definitions have no real benchmark data (`createCustomStation` always returns flat 300s placeholders), so there's nothing meaningful to predict from.
- **Level select**: reuse the `<select>` + `levelLabels` pattern from `SplitForm.tsx:326-334`.
- **Target time field**: reuse the `.field`/`.input-row` + `maskTimeInput`/`normalizeTimeInput` masked-input pattern already used for `SplitForm`'s own "Target time" field.

These three inputs are the exact pieces that looked visually "off" in the rough HTML mockup — because the mockup used ad-hoc CSS instead of the real, already-styled components. Reusing them directly resolves that.

**Scenario tables**: genuinely new UI — no existing read-only split-table component to reuse. New presentational component (see below).

## Auth-aware CTA

The closing CTA band must not say "Sign up" to a signed-in user. On mount, the page (client component for this section only — the rest of the page stays server-rendered for SEO) calls `GET /api/auth/me`, which returns `{ user }` (`null` if signed out, no 401 needed for this endpoint per current implementation).

- **Signed out:** "Sign up free to save this plan and compare it against your real splits once you've raced or trained against it." → button "Sign up free" → `/app?auth=signup`
- **Signed in:** "Log your real splits after training or racing and Ocht will show you exactly where this plan held up — and where it didn't." → button "Log my splits" → `/app`

## Calculation model

**New data required:** a run-pace-per-leg baseline by level (`starter`/`competitive`/`elite`), analogous to `Station.benchmarkSec` but for running — this does not exist anywhere in the codebase today (confirmed by search; all existing run analysis derives from actually-entered splits, never a baseline). Proposed starting values, approved by the user in brainstorming, per 1km HYROX leg:

| Level | Pace/km | 1km leg (HYROX) |
|---|---|---|
| Starter | ~5:45 | 345s |
| Competitive | ~4:40 | 280s |
| Elite | ~3:55 | 235s |

TRYKA legs (800m/500m) scale proportionally by distance. Exact constant location/name (e.g. a new `runBenchmarkSecPerKm: Record<Level, number>` export in `lib/raceFormats.ts` or `lib/analysis.ts`) decided during implementation planning.

**Scenario math**, given target finish time `T` (seconds), level `L`, and format:

- **Station benchmark total** `S = Σ station.benchmarkSec[L]` for all 8 stations in the format.
- **Run benchmark total** `R = runBenchmarkSecPerKm[L] × legDistanceKm × legCount`.
- **Baseline total** `B = S + R`.

1. **Balanced**: uniform scale factor `f = T / B`, applied to every station and every run leg (`benchmark × f`).
2. **Run-focused**: runs scaled faster than balanced (runs get `f × 0.9`), stations absorb the remaining budget so the total still equals `T` (`stationScale = (T − runTotal) / S`).
3. **Station-focused**: inverse of run-focused — stations scaled faster (`f × 0.9`), runs absorb the remaining budget (`runScale = (T − stationTotal) / R`).

All three scenarios always sum to exactly `T` by construction.

## Components

**New:**
- `app/hyrox-pacing-calculator/page.tsx` — the page itself (server component for SEO metadata + static content, per the `/what-is-hyrox` pattern).
- `components/PacingCalculator.tsx` (or similar) — client component owning target-time/level/format state, the 3-scenario computation, and the auth-check CTA. Reuses the input patterns described above rather than reinventing them.
- `lib/pacingPredictor.ts` — the pure calculation function(s) for the 3 scenarios, described above. Pure/testable, no React, following the `lib/progress.ts`-style separation already used elsewhere in the codebase.

**Modified:**
- `lib/raceFormats.ts` or `lib/analysis.ts` — add the new run-pace-per-level baseline constant (exact file decided during implementation).
- `app/sitemap.ts` — add the new route, same pattern as the HYROX/TRYKA explainer pages.

## Testing

- `lib/pacingPredictor.test.ts` — new tests: each scenario sums to the target time for all 3 formats × 3 levels; run-focused scenario has faster run splits than balanced; station-focused has faster station splits than balanced.
- `PacingCalculator.tsx` — presentational + auth-check logic; auth-check branch (signed-in vs signed-out CTA copy/link) is simple enough to unit test with a mocked `fetch`, following the existing project convention of testing logic, not presentation.

## Out of scope

- Saving a predicted plan to an account (e.g. "save this plan, compare later") — the CTA links to signup/dashboard but doesn't persist the specific scenario. A real follow-up if this proves popular, not part of this build.
- A separate `/tryka-pacing-calculator` URL — TRYKA is a format-picker option on the same page for now; a dedicated TRYKA-keyword URL is a possible later SEO addition, not required here.
