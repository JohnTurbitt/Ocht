# Report Training Visuals & Progress Metrics — Design Spec

**Date:** 2026-08-14
**Status:** Approved for planning

## Goal

Add three new visual components to the premium report (replacing/supplementing existing text-heavy sections), and extend the existing `ProgressDashboard` (History tab) with two more trackable metrics. All four items were previously identified as planned-but-unbuilt premium report enhancements; this spec turns them into a concrete build.

All four are computed entirely from data the app already has — split times the user enters (`Analysis`, `lib/analysis.ts`) and previously-saved reports (`SavedReport`, `lib/reportStorage.ts`). None require Strava or any new external data source.

## Out of scope

- **Field percentile / division placement** (comparing a user's finish time to other real athletes) — explicitly deferred, needs a curated benchmark dataset that doesn't exist yet. Not part of this spec.
- Any change to `lib/analysis.ts`'s public `Analysis` return shape — all three report components derive what they need from fields that already exist on `Analysis`, confirmed by reading the current source (see field references below). No engine changes.
- Mobile-specific layout iteration beyond following the existing `.format-body`/report responsive patterns — verified visually during implementation, not separately designed here.

## 1. Time-distribution bar

**New component:** `components/RaceTimeDistribution.tsx`
**Placement:** Premium detail block in `ReportPanel.tsx`, before the Race Story / Station Ranking sections (i.e., near the top of the premium content, as a quick "where did the race go" overview).

Renders a single horizontal stacked bar — run time / station time / roxzone time as segments of total race time — with a label row underneath showing each segment's percentage, matching the "stacked bar" style approved in brainstorming (not a donut ring).

**Data (all existing `Analysis` fields, no new computation):**
- `analysis.totalRunSeconds`
- `analysis.totalStationSeconds`
- `analysis.roxzoneSeconds`
- `analysis.hasRoxzone`

**Behavior:** If `hasRoxzone` is `false` (no official finish time entered), render a 2-segment bar (run/station only) — roxzone time can't be isolated without an official finish, so it must not be shown as a fabricated 0% segment.

**Colors:** run = `--lime`, station = a secondary accent already in the palette (e.g. `--teal` or existing station-leak green), roxzone = `--red` (matches existing leak-severity convention: red = time lost, per `ocht-design-language` memory).

## 2. Fatigue / pace-decay curve

**New component:** `components/RunFadeCurve.tsx`
**Placement:** Replaces the existing prose "Race Story" section in `ReportPanel.tsx` (same slot, not additive).

A shaded-area line chart (recharts, already a dependency) of pace per run leg (8 points for standard HYROX/TRYKA), with a dashed reference line for the "flat pace" target, and a marker on the single worst-fading leg.

**Data (all existing `Analysis` fields, no new computation):**
- `analysis.raceSegments.filter(s => s.type === "run")` — already in race order, each with `actualSeconds`
- `analysis.targetRunAverageSeconds` — the flat-pace reference line
- Worst-leg marker = the run segment with the largest `actualSeconds - targetRunAverageSeconds`

**Removed:** the prose "Race Story" paragraph(s) it replaces — confirm exact JSX block during implementation and remove cleanly rather than leaving dead text alongside the new chart.

## 3. Station performance octagon

**New component:** `components/StationOctagon.tsx`
**Placement:** Replaces the existing text "Station Ranking" list in `ReportPanel.tsx` (same slot, not additive).

An 8-axis radar chart shaped as a regular octagon when every station is exactly at benchmark (deliberate callback to "Ocht" = eight, and the existing octagon-8 brand motif used elsewhere — hero spinner, ghost watermark). A dashed reference octagon marks "on benchmark" for every station; the filled actual shape pulls inward on stations where the athlete is slower than benchmark, and can push outward past the reference on stations where they're faster. Below the chart, a compact 3-row list names the top leak stations with their exact `+Ns` gap (addresses the "hard to read exact values on a radar" concern raised during brainstorming).

**Data:**
- **Fixed axis order:** `analysis.stationDefinitions` (NOT `analysis.stationResults`, which is sorted by leak severity — the radar needs a stable, consistent station order so the shape is visually comparable between reports). Build a `Map` from `analysis.stationResults` keyed by `station.key` and look up each `stationDefinitions[i].key` to get that station's `seconds`/`benchmark`/`gap` in fixed order.
- **Vertex radius formula:** `radius = maxRadius * clamp(benchmark / seconds, 0.4, 1.25)`. `seconds === benchmark` → exactly on the dashed reference ring. Slower (`seconds > benchmark`) → pulled inward. Faster → pushed outward, clamped so one very fast/slow station can't visually break the chart.
- **Top-3 leak list:** `analysis.stationResults.slice(0, 3)` — already sorted worst-first by `score`, no new logic needed. Each row shows `station.label` and `+{gap}s`.

**Colors:** vertex/segment color graded by `gap` severity, matching the existing leak-severity palette (green low gap, amber mid, red high — same bands as `FitnessInsights` hint thresholds where reasonable, exact cutoffs decided during implementation).

## 4. ProgressDashboard: roxzone + archetype trend

**Modified files:** `lib/progress.ts`, `components/ProgressDashboard.tsx`
**No new component** — extends the existing metric-picker pattern (`finish` / `readiness` / `fade` / `gap`) already live in the History tab.

**`ProgressPoint` type additions (`lib/progress.ts`):**
```ts
roxzonePercent: number;
hasRoxzone: boolean;
archetypeScores: ArchetypeScores; // { engine, strength, durability, consistency }, from lib/analysis.ts
```
Populated in `toPoint()` from `analysis.roxzonePercent`, `analysis.hasRoxzone`, `analysis.archetype.scores` — all already computed by `buildAnalysis`, which `toPoint()` already calls.

**`METRICS` additions (`components/ProgressDashboard.tsx`):** 5 new selectable entries — Roxzone tax, Engine, Strength, Durability, Consistency — following the exact shape of the existing `METRICS` array (`id`, `label`, `key`, `kind`). Archetype scores use `kind: "score"` (0-100, same as `readiness`). Roxzone tax is a percentage — format distinctly from the existing `"time"`/`"score"` kinds (new `kind: "percent"` or reuse `"score"` with a `%` suffix in `formatValue`, decided during implementation).

**Roxzone-line filtering:** when `metricId === "roxzone"`, filter `summary.points` to only points where `hasRoxzone` is `true` before building `chartData`. Reports without an official finish time must not plot as a false "0% roxzone tax" — they should be absent from that line entirely, not zeroed.

## Testing

Follows existing project convention (see `ocht-design-language` memory: "don't unit-test presentational/CSS/motion components — verify by eye").

- **`lib/progress.test.ts`**: add cases for the new `roxzonePercent`/`hasRoxzone`/`archetypeScores` fields on `toPoint()`, and for the roxzone-line filtering behavior (mixed reports with/without `hasRoxzone` → only the `hasRoxzone: true` points appear in the filtered series).
- **`RaceTimeDistribution.tsx`, `RunFadeCurve.tsx`, `StationOctagon.tsx`**: presentational, no new unit tests — verified visually in both themes during implementation, per existing convention.
- No changes to `lib/analysis.ts`, so no new `analysis.test.ts` cases needed — full regression run (`npm test`) confirms no drift.

## File summary

**New:**
- `components/RaceTimeDistribution.tsx`
- `components/RunFadeCurve.tsx`
- `components/StationOctagon.tsx`

**Modified:**
- `components/ReportPanel.tsx` (mount the 3 new components; remove replaced prose sections)
- `lib/progress.ts` (extend `ProgressPoint`, `toPoint()`)
- `components/ProgressDashboard.tsx` (extend `METRICS`, roxzone-line filtering)
- `lib/progress.test.ts` (new test cases)
- Relevant SCSS partial(s) for the 3 new components' styling (exact file TBD by existing report SCSS structure — likely `styles/_report.scss`, confirmed during implementation)
