# Race Flow Map Redesign Design

## Problem

`RaceFlowMap` (`components/RaceVisuals.tsx`) — the report's segment-by-segment breakdown — reads as "homemade" rather than professional: a heavily decorated Recharts bar chart with hatched lost-time zones, rotated teardrop leak-rank pins, target-line overlays, and an 8-item legend, paired with a detail panel (`SegmentInsightPanel`) crowded with a letter grade, a phase label, and two separate stat grids plus a "coach read" paragraph. The result is visually cluttered and text-heavy compared to the clean, minimal split-list style of Strava's own splits view.

## Goals

- Replace the current chart with a slim, labeled row-per-segment layout (mockup-validated direction "A": split rows) that communicates good/watch/leak status at a glance via color, with real numbers (not just color) on every row.
- Redesign the click-to-open detail panel to be shorter and clearer — drop the letter grade, phase label, and dual stat grids; keep only actual/target/cost plus one explanatory sentence.
- Add "vs your last race" as a genuine new data point: a per-segment delta against the most recent comparable prior report, surfaced both as a small colored indicator per row and as a sentence in the detail panel.
- Add motion: bars fill in on load (staggered), the panel slides/fades open instead of snapping, matching the count-up/reveal motion language already used elsewhere in the app (`CountUp` on archetype scores).
- Drop Recharts for this specific component — the new design doesn't need a charting library.

## Out of scope

- `TimeLeakHeatmap`, `RaceStory`, `PremiumReportPoster` (other exports in `components/RaceVisuals.tsx`) — untouched.
- `ProgressDashboard.tsx`'s own, separate Recharts usage — untouched; only `RaceFlowMap` drops the dependency.
- Any change to how `Analysis`/`RaceSegment` are computed in `lib/analysis.ts` — the redesign consumes the existing `analysis.raceSegments` data as-is; segment `id`s are already stable (`run-1`, `station-ski`, etc.) and require no changes.

## Design

### 1. Row list (replaces the Recharts bar chart)

One row per segment, in race order, rendered as plain flex/CSS (no SVG/charting library):

- **Label** (segment name, e.g. "Run 1", "SkiErg"), plus an optional small badge underneath: "Fastest split" (lime) on the single best segment in the race, "Biggest leak" (red) on the single worst — replacing the old rotated teardrop pin.
- **Proportional track**: a thin rounded bar, width = `segment.actualSeconds / longestSegmentActualSeconds` in that race (the slowest segment in the report is the one at 100% width) — same relative-to-max scaling the current Recharts `XAxis` already produces, just implemented directly instead of via a chart library. Fill color = `statusColor(segment.status)` (existing `strong`/`steady`/`leak` mapping, reused as-is).
- **Time**, right-aligned, with a small delta line underneath when a comparable previous report exists (see section 3): `▼ 4s` in `--flow-strong` green (faster) or `▲ 11s` in `--flow-leak` red (slower). Omitted entirely (no row, no placeholder) when there's no comparable previous report or no matching segment in it.
- **Chevron** affordance (already present today) indicating the row is tappable.
- On load, each bar's fill animates from `width: 0` to its target width via a CSS `transition`, triggered a tick after mount, staggered per row (~90ms apart) — no JS animation library, just a CSS class toggle.

**Legend** shrinks from the current 8 items to 3: Strong / Watch / Leak (color dot + label). Lost-time zone hatching, the leak-marker pin, the target line, and the run/station end-cap color coding are all dropped — none of them survive in the new design.

### 2. Detail panel (`SegmentInsightPanel` rewrite)

Opens on row click/tap (same trigger mechanism as today — `onClick`/`onPointerDown`/keyboard `Enter`/`Space`, and the existing `openSegmentId`/`openSignal` external-trigger props on `RaceFlowMap` are preserved unchanged, since other parts of the report already use them to jump to a specific segment).

Structure:
- A thin 4px accent bar across the top in the segment's status color (replaces tinting the whole panel background).
- Panel background: neutral near-black (`#1a1d1c`-equivalent — an actual token gets added to `_base.scss` alongside the existing `--flow-*` variables, not a hardcoded hex, since this app is dark/light themed), not the same green-tinted surface as the page.
- Close button: a circular icon button, top-right corner of the panel (reuses the existing `.modal-close` button styling already established for other modals in this app — `styles/_buttons.scss` — rather than the current bespoke `.segment-insight__close` treatment).
- Header: segment name + a small status pill (Strong/Watch/Leak), no letter grade, no phase label.
- Stats row: Actual / Target / Cost, plus a 4th stat — "Race total so far" (the existing `cumulativeGapSeconds` value, already computed today, just not currently surfaced in the panel).
- One explanatory sentence (the existing `buildCoachRead`-style copy, trimmed to a single sentence — no separate "coach read" heading).
- A "vs your last race" line when comparison data exists (section 3), with a colored ▼/▲ arrow matching the row-level indicator convention, in its own subtly-set-off block (light background tint, not another full stat grid).
- Panel open/close transitions via `max-height`/`opacity`/`transform`, not an instant `display` toggle.

### 3. "Vs your last race" comparison

New function `buildPreviousSegmentMap(reports: SavedReport[], currentReport: SavedReport): Map<string, number> | null` in `lib/progress.ts` (alongside the existing `groupKeyForReport`, which it reuses):

1. Filter `reports` to those sharing `groupKeyForReport(currentReport)`, excluding `currentReport` itself (by `id`).
2. If none remain, return `null`.
3. Pick the most recent remaining report by `createdAt`.
4. Recompute its `Analysis` via the existing `buildAnalysis()` — resolving `stationDefinitions` the same way `app/app/live/page.tsx` already does (`raceFormat === "custom" ? report.stationDefinitions ?? [] : getRaceFormatStations(report.raceFormat)`), since `SavedReport` already carries every raw field `buildAnalysis` needs (`raceFormat`, `goal`, `targetTime`, `level`, `runs`, `stationSplits`, `officialFinishTime`).
5. Return a `Map` from `raceSegments[].id` to `actualSeconds`.

`ReportPanel.tsx` computes this once via `useMemo` (same pattern as its existing `prMap = useMemo(() => buildPRMap(...), [...])`) and passes it to `RaceFlowMap` as a new optional prop `previousSegmentSeconds?: Map<string, number> | null`. `RaceFlowMap` looks up each segment's `id` in that map to compute the per-row delta; a segment with no entry (map is `null`, or that specific `id` isn't present — e.g. a custom race with a different station set than last time) simply shows no delta for that row.

This is intentionally a *different, new* helper from the existing `buildPRMap` (`lib/prUtils.ts`) — that one already exists for a different purpose (best-ever station time, ungated by race format, stations only) and is left untouched; this feature is "most recent comparable report," covering both runs and stations, gated to the same race format.

### 4. Removing Recharts from this component

`components/RaceVisuals.tsx` currently imports `Bar`, `BarChart`, `CartesianGrid`, `ResponsiveContainer`, `XAxis`, `YAxis`, `BarShapeProps` from `recharts`, used only by `RaceFlowMap`/`FlowBarShape`. All of that — plus `FlowBarShape`, the `<defs><pattern id="race-flow-lost-zone">` hatching, `compactChart`'s chart-height calculation, and the `matchMedia` breakpoint effect purely for chart sizing — is deleted. `TimeLeakHeatmap`, `RaceStory`, and `PremiumReportPoster` don't use Recharts today and are unaffected. `ProgressDashboard.tsx`'s own Recharts import is separate and untouched — the `recharts` package itself stays a dependency.

## Files touched

- `components/RaceVisuals.tsx` — `RaceFlowMap` and `SegmentInsightPanel` rewritten per sections 1–2; `FlowBarShape`, chart-sizing logic, and Recharts imports removed. `TimeLeakHeatmap`, `RaceStory`, `PremiumReportPoster` untouched.
- `lib/progress.ts` — add `buildPreviousSegmentMap`.
- `components/ReportPanel.tsx` — compute `previousSegmentSeconds` via `useMemo` and pass to `RaceFlowMap`.
- `styles/_report.scss` — replace the `.race-flow*`/`.segment-insight*` rule blocks with the new row/panel styles; legend rules simplified to 3 items.
- `styles/_base.scss` — add a neutral panel-background token for the detail panel (theme-aware, not a hardcoded hex).
