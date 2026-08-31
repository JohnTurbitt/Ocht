# Archetype Data Integrity & Confidence Design

## Problem

A report generated with splits that were "basically all 00:00" produced a fully-confident, specific archetype (The Dagda: "Immovable at the stations. The runs cost you.") — a narrative that isn't true of the underlying (non-)data. Two distinct defects combine to cause this:

1. **No plausibility floor.** `isValidTime()` (`lib/validation.ts`) only checks *format* (digits, seconds < 60) — `"0"` and `"0:00"` both pass as "valid," even though no station or run split can physically take zero seconds. Every one of the 16 splits is already mandatory (server- and client-side), so this gap means a full "clean" submission of impossible times sails straight into the analysis engine as if it were real, elite-level data.
2. **Structural asymmetry in the archetype comparison.** `buildArchetype()` (`lib/analysis.ts`) picks between "stations are your limiter" (Fionn mac Cumhaill) and "runs are your limiter" (The Dagda) by comparing `stationLeakTotal` (an absolute benchmark gap, floored at zero — a station can never score *worse* than "at benchmark") against `runLeakTotal` (`runFadeSeconds × 4 + runVolatilitySeconds × 3.2` — a purely self-relative measure of variance across the athlete's own 8 splits, with no external anchor and no floor). A run set containing a mix of real and placeholder/zero splits produces large fade/volatility purely from that inconsistency, which the comparison reads as a genuine "running is the limiter" signal. Even with fully real data, this asymmetry means small, statistically meaningless differences can cross the existing 1.4× ratio gate and produce a fully-confident narrative.

## Goals

- Splits that are physically impossible are rejected at submission, not analyzed as if real.
- The run-vs-station archetype comparison is put on the same footing on both sides (both anchored to an external benchmark, not one self-relative and one absolute).
- Comparative archetypes (Fionn/Dagda) require a real, meaningful margin, not just a ratio that noise can cross.
- Reports built from borderline data communicate that plainly — the archetype visibly carries a confidence level, matching a pattern (`buildRunningDiagnosis`'s low/medium/high) already established elsewhere in this app.

## Out of scope

- `ShareCards.tsx` (public social-share image) and `ArchetypeAchievements.tsx` (lifetime archetype-unlock gallery) — neither gets a confidence badge in this pass.
- Population/percentile-based benchmarking (comparing a user's splits against real aggregated data from other users) — a much larger data-pipeline investment, not pursued here. Benchmarks stay the existing hand-authored `benchmarkSec`/`runPaceSecPerKm` constants.
- Any change to the non-comparative archetypes' own trigger thresholds (Setanta's consistency cutoff, Brigid/Oisín's durability cutoffs, Lugh's dual cutoff, Cormac's fallback) — those keep their existing logic untouched; only Fionn/Dagda's comparison basis and gate change.

## Design

### 1. Plausibility floors

Derived entirely from data already in the codebase — no new domain research, no arbitrary constants invented from scratch:

- `lib/raceFormats.ts`: `RaceFormatOption` gains `runDistanceKm: number | null`. Set per format: `hyrox: 1`, `tryka800: 0.8`, `tryka500: 0.5`. `getRaceFormatOption("custom")`'s literal returns `runDistanceKm: null` (no fixed distance for a user-defined format).
- New pure functions (home: `lib/validation.ts`, since they exist purely to support validation, not general analysis):
  - `const FLAT_MIN_PLAUSIBLE_SECONDS = 12` — a generous sanity floor for cases with no calibrated data (custom format).
  - `const RUN_FLOOR_PACE_RATIO = 0.5` — no plausible race-day run beats elite baseline pace by 2×.
  - `const STATION_FLOOR_RATIO = 0.5` — no plausible race-day station effort beats the elite benchmark by 2×.
  - `minPlausibleRunSeconds(distanceKm: number | null): number` → `distanceKm == null ? FLAT_MIN_PLAUSIBLE_SECONDS : Math.max(FLAT_MIN_PLAUSIBLE_SECONDS, Math.round(runPaceSecPerKm.elite * RUN_FLOOR_PACE_RATIO * distanceKm))`.
  - `minPlausibleStationSeconds(station: Station): number` → `Math.max(FLAT_MIN_PLAUSIBLE_SECONDS, Math.round(station.benchmarkSec.elite * STATION_FLOOR_RATIO))`.
- `ValidationInput` (`lib/validation.ts`) gains `raceFormat?: RaceFormat` (default `"hyrox"`, matching the existing `stationDefinitions = stations` default style already used in this function's signature).
- `validateReportInput` resolves `runDistanceKm` from `getRaceFormatOption(raceFormat)` (custom → its own `stationDefinitions` param already carries the real per-race stations, but `runDistanceKm` still resolves to `null` for custom via the same lookup) and, for every run/station split that passes `isValidTime`, additionally checks it against the relevant floor. A split below floor gets a distinct message from a merely-malformed one: `"That's faster than physically possible — check this split."` (vs. the existing `"Use a valid time like 5:30."` for a malformed one), because these are different problems for the athlete to fix (mistyped vs. accidentally-zeroed).
- Both existing call sites pass `raceFormat` through — `app/app/page.tsx`'s `handleSubmit` (already has `raceFormat` as component state) and `app/api/reports/route.ts`'s `parseReportPayload` (already resolves `raceFormat` earlier in the same function).
- `lib/validation.test.ts`'s two existing `validateReportInput()` calls need no changes (they use real, plausible split values from `initialRuns`/`initialStations`, well above any floor, and `raceFormat` defaults to `"hyrox"`) — new tests are added alongside them for the floor behavior itself.

### 2. Symmetric run-vs-station comparison

In `buildAnalysis()` (`lib/analysis.ts`), alongside the existing `stationLeakTotal` computation:

```
runBenchmarkSeconds = runDistanceKm == null ? null : runPaceSecPerKm[level] * runDistanceKm
runGapTotal = runBenchmarkSeconds == null
  ? null
  : runSeconds.reduce((total, seconds) => total + Math.max(0, seconds - runBenchmarkSeconds), 0)
```

`runGapTotal` (when available — i.e. not custom) replaces the old `runFadeSeconds * 4 + runVolatilitySeconds * 3.2` as the value passed into `buildArchetype` as `runLeakTotal`, specifically for the Fionn/Dagda comparison. For custom races (`runGapTotal === null`), fall back to the existing fade+volatility formula — documented in a code comment as a deliberate format-specific fallback (no distance data to build a real benchmark from), not an oversight.

Fade (`runFadeSeconds`) and volatility (`runVolatilitySeconds`) are unchanged everywhere else — they still drive their own separate `runFadeLeak`/`pacingLeak` line items in `topLeaks`, and still feed `scores.durability`/`scores.consistency`/`scores.engine` in `buildArchetype`. This change only touches what decides *"are runs or stations the bigger limiter"* — not the other leak diagnostics or scores.

`buildArchetype`'s Fionn/Dagda gates change from a bare ratio to ratio **and** a minimum absolute margin:

```
const MIN_COMPARATIVE_MARGIN_SECONDS = 30;

// Fionn mac Cumhaill
if (stationLeakTotal > runLeakTotal * 1.4 && stationLeakTotal - runLeakTotal >= MIN_COMPARATIVE_MARGIN_SECONDS) { ... }

// The Dagda
if (runLeakTotal > stationLeakTotal * 1.4 && runLeakTotal - stationLeakTotal >= MIN_COMPARATIVE_MARGIN_SECONDS) { ... }
```

A gap that clears the ratio but not the 30s margin falls through toward Lugh/Cormac instead of producing an overconfident, statistically-thin narrative.

### 3. Confidence scoring, surfaced inline

`AthleteArchetype` (`lib/analysis.ts`) gains `confidence: "low" | "medium" | "high"`, computed in `buildArchetype` from two signals, mirroring the tiering style already established in `buildRunningDiagnosis` (`lib/trainingContext.ts`):

- **`nearFloorCount`** (applies to every archetype): how many of the 16 splits sit within 20% of their respective plausibility floor (computed in `buildAnalysis` alongside the other per-split derived values, passed into `buildArchetype` as a new `ArchetypeInputs` field). This is a general data-quality signal independent of which archetype fires.
- **Margin comfort** (applies only when Fionn/Dagda fire): how far the actual margin clears the new 30s minimum — a 31s margin is a bare pass, a 90s margin is decisive.

Tiering (mirroring `buildRunningDiagnosis`'s three-tier, threshold-based style):
- **High:** `nearFloorCount === 0`, and (if comparative) margin ≥ 2× the minimum (60s+).
- **Medium:** `nearFloorCount` 1–2, or (if comparative) margin between 30–60s.
- **Low:** `nearFloorCount ≥ 3`.

For non-comparative archetypes (Setanta, Cú Chulainn, Brigid, Oisín, Lugh, Cormac, Morrígan), confidence is driven by `nearFloorCount` alone — no bespoke margin logic is added for each of those threshold checks individually (out of scope, per the "Out of scope" section above; YAGNI on inventing per-branch margin semantics that don't have a natural analog outside the Fionn/Dagda ratio comparison).

`AthleteArchetypeCard.tsx` and `ResultsReveal.tsx` render the confidence inline next to the archetype name — e.g. `<strong>{archetype.label}</strong> · {confidenceLabel} confidence` — reusing the plain-text style already used for `ReportPanel.tsx`'s running-diagnosis confidence label (no new badge/pill component; this app's existing convention for confidence is plain text, not a colored chip).

## Files touched

- `lib/raceFormats.ts` — add `runDistanceKm` to `RaceFormatOption` and its four definitions.
- `lib/validation.ts` — add floor constants/helpers, extend `ValidationInput`/`validateReportInput` with `raceFormat` and floor checks.
- `lib/validation.test.ts` — add tests for floor rejection (below floor → invalid, with the new message) and floor acceptance (right at/above floor → valid).
- `lib/analysis.ts` — compute `runBenchmarkSeconds`/`runGapTotal`/`nearFloorCount` in `buildAnalysis`; change `buildArchetype`'s `ArchetypeInputs` (add `nearFloorCount`, keep `runLeakTotal` but it now sometimes carries `runGapTotal` instead of the old formula), Fionn/Dagda gates, and `AthleteArchetype`'s new `confidence` field.
- `lib/analysis.test.ts` (existing file) — add tests for: a near-all-zero submission no longer producing a specific comparative archetype (falls through to Cormac/Lugh instead, or is rejected earlier by validation so never reaches `buildAnalysis` at all — the floor in `validateReportInput` should make this scenario unreachable via the real submission path, but `buildAnalysis` itself is also called directly in tests, so it should independently not misfire on such input); a real, close station/run leak difference no longer producing Fionn/Dagda when under the 30s margin; confidence tiering at each level.
- `app/app/page.tsx` — pass `raceFormat` into its `validateReportInput` call.
- `app/api/reports/route.ts` — pass `raceFormat` into its `validateReportInput` call.
- `components/AthleteArchetypeCard.tsx` — render `archetype.confidence` inline next to the name.
- `components/ResultsReveal.tsx` — render `archetype.confidence` inline next to the name.
