# Archetype Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop physically impossible splits (like `0:00`) from producing a confident, specific archetype narrative, by (1) rejecting them at submission, (2) putting the run-vs-station archetype comparison on the same footing on both sides, and (3) surfacing a visible confidence level on every archetype.

**Architecture:** A plausibility floor is added to `lib/validation.ts` (blocking bad input before it reaches analysis), and `lib/analysis.ts`'s `buildArchetype`/`buildAnalysis` gain a symmetric run benchmark, a minimum-margin gate on the comparative archetypes, and a `confidence` field threaded through to the two components that display an archetype.

**Tech Stack:** TypeScript, Vitest, no new dependencies.

**Full spec:** `docs/superpowers/specs/2026-08-31-archetype-data-integrity-design.md`

---

## Confirmed deviations from the spec, discovered while planning

**1. The floor/benchmark math is duplicated between `lib/validation.ts` and `lib/analysis.ts`, not centralized, for a hard architectural reason.** `lib/raceFormats.ts` already imports `stations` from `lib/analysis.ts` at module-evaluation time (to build `raceFormatOptions`), and `lib/validation.ts` already imports `stations`/`parseTime` from `lib/analysis.ts` too. If `lib/analysis.ts` imported the floor helpers back from either of those files, it would create a circular module dependency: `lib/raceFormats.ts`'s top-level `raceFormatOptions` array is built by calling functions that read `stations`, and if `lib/analysis.ts` were also waiting on `lib/raceFormats.ts` to finish loading first, `stations` wouldn't be defined yet when `lib/raceFormats.ts` needs it — this breaks at load time, not just as a lint nit. So `lib/analysis.ts` gets its own small, private, clearly-commented copy of the pace/distance/floor constants, cross-referencing `lib/validation.ts` and `lib/raceFormats.ts` so a future change to one is easy to notice needs to happen in the other. This does NOT affect behavior — both copies use identical values — only where the code lives.

**2. The confidence tiering combination rule is more precise than the spec's bullet list.** The spec describes "High/Medium/Low" as a list of conditions without fully specifying what happens when the two signals (near-floor count and comparative margin) disagree (e.g. `nearFloorCount = 1` but a decisive 90s margin). This plan resolves it with a "worst signal wins" rule: each signal maps to a 0/1/2 tier, and the final confidence is the *lower* of the two tiers. This reduces cleanly to every case the spec explicitly describes, and gives an unambiguous answer for the cases it didn't.

**3. Verified by hand, not just asserted: none of the 4 existing archetype tests in `lib/analysis.test.ts` need to change.** The Fionn mac Cumhaill test's real numbers (`stationLeakTotal = 405`, new `runLeakTotal = 160` under the symmetric formula) still clear both the 1.4× ratio and the new 30s margin (`405 > 224`, margin `245 ≥ 30`), so it still resolves to Fionn. The Setanta/Morrígan tests fire on branches checked *before* the Fionn/Dagda comparison is ever reached, so they're unaffected. The score-bounds test only checks `scores`, which nothing in this plan touches. Task 5 only *adds* new tests; it does not modify these four.

---

### Task 1: `lib/raceFormats.ts` — add `runDistanceKm` to `RaceFormatOption`

**Files:**
- Modify: `lib/raceFormats.ts`

- [ ] **Step 1: Add the field to the type**

Find:
```ts
export type RaceFormatOption = {
  id: RaceFormat;
  label: string;
  description: string;
  runLabel: string;
  stationHeading: string;
  stations: Station[];
};
```

Replace with:
```ts
export type RaceFormatOption = {
  id: RaceFormat;
  label: string;
  description: string;
  runLabel: string;
  runDistanceKm: number | null;
  stationHeading: string;
  stations: Station[];
};
```

- [ ] **Step 2: Set it on each of the three real formats**

Find:
```ts
export const raceFormatOptions: RaceFormatOption[] = [
  {
    id: "hyrox",
    label: "HYROX",
    description: "8 x 1km runs and the standard HYROX station order.",
    runLabel: "1km run",
    stationHeading: "Stations",
    stations,
  },
  {
    id: "tryka800",
    label: "TRYKA 800",
    description: "8 x 800m runs with TRYKA stations.",
    runLabel: "800m run",
    stationHeading: "TRYKA stations",
    stations: buildTrykaStations(),
  },
  {
    id: "tryka500",
    label: "TRYKA 500",
    description: "8 x 500m runs with TRYKA stations.",
    runLabel: "500m run",
    stationHeading: "TRYKA stations",
    stations: buildTrykaStations(),
  },
];
```

Replace with:
```ts
export const raceFormatOptions: RaceFormatOption[] = [
  {
    id: "hyrox",
    label: "HYROX",
    description: "8 x 1km runs and the standard HYROX station order.",
    runLabel: "1km run",
    runDistanceKm: 1,
    stationHeading: "Stations",
    stations,
  },
  {
    id: "tryka800",
    label: "TRYKA 800",
    description: "8 x 800m runs with TRYKA stations.",
    runLabel: "800m run",
    runDistanceKm: 0.8,
    stationHeading: "TRYKA stations",
    stations: buildTrykaStations(),
  },
  {
    id: "tryka500",
    label: "TRYKA 500",
    description: "8 x 500m runs with TRYKA stations.",
    runLabel: "500m run",
    runDistanceKm: 0.5,
    stationHeading: "TRYKA stations",
    stations: buildTrykaStations(),
  },
];
```

- [ ] **Step 3: Set it to `null` for custom**

Find (inside `getRaceFormatOption`):
```ts
  if (format === "custom") {
    return {
      id: "custom",
      label: "Custom",
      description: "Build your own race format.",
      runLabel: "run",
      stationHeading: "Custom stations",
      stations: [],
    } satisfies RaceFormatOption;
  }
```

Replace with:
```ts
  if (format === "custom") {
    return {
      id: "custom",
      label: "Custom",
      description: "Build your own race format.",
      runLabel: "run",
      runDistanceKm: null,
      stationHeading: "Custom stations",
      stations: [],
    } satisfies RaceFormatOption;
  }
```

- [ ] **Step 4: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/raceFormats.ts
git commit -m "Add runDistanceKm to RaceFormatOption"
```

---

### Task 2: `lib/validation.ts` — plausibility floor

**Files:**
- Modify: `lib/validation.ts`

- [ ] **Step 1: Update imports and add the floor constants/helpers**

Find:
```ts
import type { Station, StationKey } from "./analysis";
import { stations } from "./analysis";

export type ValidationInput = {
  targetTime: string;
  runs: string[];
  stationSplits: Record<StationKey, string>;
  stationDefinitions?: Station[];
};
```

Replace with:
```ts
import type { RaceFormat } from "./raceFormats";
import type { Station, StationKey } from "./analysis";
import { parseTime, stations } from "./analysis";
import { getRaceFormatOption, runPaceSecPerKm } from "./raceFormats";

export type ValidationInput = {
  targetTime: string;
  runs: string[];
  stationSplits: Record<StationKey, string>;
  stationDefinitions?: Station[];
  raceFormat?: RaceFormat;
};
```

- [ ] **Step 2: Add the floor constants and helper functions**

Find:
```ts
const timePattern = /^\d+(?::\d{1,2}){0,2}$/;
```

Replace with:
```ts
const timePattern = /^\d+(?::\d{1,2}){0,2}$/;

// No plausible race-day run/station effort beats the elite baseline by 2x —
// these floors exist purely to catch impossible/placeholder entries (e.g.
// "0:00"), not to be a tight bound. FLAT_MIN_PLAUSIBLE_SECONDS is the
// fallback used when there's no real calibrated data to derive a floor from
// (a custom race's run distance is unknown, and its stations use a flat
// placeholder benchmark — see createCustomStation in lib/raceFormats.ts).
const FLAT_MIN_PLAUSIBLE_SECONDS = 12;
const RUN_FLOOR_PACE_RATIO = 0.5;
const STATION_FLOOR_RATIO = 0.5;

function minPlausibleRunSeconds(raceFormat: RaceFormat): number {
  const { runDistanceKm } = getRaceFormatOption(raceFormat);

  if (runDistanceKm == null) {
    return FLAT_MIN_PLAUSIBLE_SECONDS;
  }

  return Math.max(
    FLAT_MIN_PLAUSIBLE_SECONDS,
    Math.round(runPaceSecPerKm.elite * RUN_FLOOR_PACE_RATIO * runDistanceKm),
  );
}

function minPlausibleStationSeconds(
  station: Station,
  raceFormat: RaceFormat,
): number {
  if (raceFormat === "custom") {
    return FLAT_MIN_PLAUSIBLE_SECONDS;
  }

  return Math.max(
    FLAT_MIN_PLAUSIBLE_SECONDS,
    Math.round(station.benchmarkSec.elite * STATION_FLOOR_RATIO),
  );
}
```

- [ ] **Step 3: Wire the floor checks into `validateReportInput`**

Find:
```ts
export function validateReportInput({
  targetTime,
  runs,
  stationSplits,
  stationDefinitions = stations,
}: ValidationInput): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  if (!isValidTime(targetTime)) {
    const message = "Enter a valid target time, for example 1:25:00.";
    errors.push(message);
    fieldErrors.targetTime = message;
  }

  runs.forEach((split, index) => {
    if (!isValidTime(split)) {
      const message = `Run ${index + 1} needs a valid time, for example 5:30.`;
      errors.push(message);
      fieldErrors[`run-${index}`] = "Use a valid time like 5:30.";
    }
  });

  stationDefinitions.forEach((station) => {
    if (!station.label.trim()) {
      const message = "Each custom station needs a name.";
      errors.push(message);
      fieldErrors[`station-${station.key}-label`] = message;
    }

    if (!isValidTime(stationSplits[station.key])) {
      const message = `${station.label} needs a valid time, for example 5:00.`;
      errors.push(message);
      fieldErrors[`station-${station.key}`] = "Use a valid time like 5:00.";
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
}
```

Replace with:
```ts
export function validateReportInput({
  targetTime,
  runs,
  stationSplits,
  stationDefinitions = stations,
  raceFormat = "hyrox",
}: ValidationInput): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  if (!isValidTime(targetTime)) {
    const message = "Enter a valid target time, for example 1:25:00.";
    errors.push(message);
    fieldErrors.targetTime = message;
  }

  const runFloorSeconds = minPlausibleRunSeconds(raceFormat);

  runs.forEach((split, index) => {
    if (!isValidTime(split)) {
      const message = `Run ${index + 1} needs a valid time, for example 5:30.`;
      errors.push(message);
      fieldErrors[`run-${index}`] = "Use a valid time like 5:30.";
    } else if (parseTime(split) < runFloorSeconds) {
      const message = `Run ${index + 1} is faster than physically possible — check this split.`;
      errors.push(message);
      fieldErrors[`run-${index}`] = "That's faster than physically possible.";
    }
  });

  stationDefinitions.forEach((station) => {
    if (!station.label.trim()) {
      const message = "Each custom station needs a name.";
      errors.push(message);
      fieldErrors[`station-${station.key}-label`] = message;
    }

    if (!isValidTime(stationSplits[station.key])) {
      const message = `${station.label} needs a valid time, for example 5:00.`;
      errors.push(message);
      fieldErrors[`station-${station.key}`] = "Use a valid time like 5:00.";
    } else if (
      parseTime(stationSplits[station.key]) <
      minPlausibleStationSeconds(station, raceFormat)
    ) {
      const message = `${station.label} is faster than physically possible — check this split.`;
      errors.push(message);
      fieldErrors[`station-${station.key}`] =
        "That's faster than physically possible.";
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
}
```

- [ ] **Step 4: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the existing validation tests**

Run: `npx vitest run lib/validation.test.ts`
Expected: all pass unchanged — `initialRuns`/`initialStations` (used by the existing tests) are well above any floor (e.g. the fastest, `farmers: "3:40"` = 220s, is far above `farmers`'s floor of `max(12, 180*0.5) = 90`), so no existing assertion is affected.

- [ ] **Step 6: Commit**

```bash
git add lib/validation.ts
git commit -m "Reject splits faster than physically possible"
```

---

### Task 3: `lib/validation.test.ts` — floor tests

**Files:**
- Modify: `lib/validation.test.ts`

- [ ] **Step 1: Add the new tests**

Find:
```ts
describe("validateReportInput", () => {
  it("returns valid when all report inputs are valid", () => {
    const result = validateReportInput({
      targetTime: "1:25:00",
      runs: initialRuns,
      stationSplits: initialStations,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.fieldErrors).toEqual({});
  });

  it("reports target, run and station errors", () => {
    const result = validateReportInput({
      targetTime: "1:99:00",
      runs: ["", ...initialRuns.slice(1)],
      stationSplits: {
        ...initialStations,
        wallBalls: "bad",
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Enter a valid target time, for example 1:25:00.",
    );
    expect(result.errors).toContain("Run 1 needs a valid time, for example 5:30.");
    expect(result.errors).toContain(
      "Wall balls needs a valid time, for example 5:00.",
    );
    expect(result.fieldErrors.targetTime).toBe(
      "Enter a valid target time, for example 1:25:00.",
    );
    expect(result.fieldErrors["run-0"]).toBe("Use a valid time like 5:30.");
    expect(result.fieldErrors["station-wallBalls"]).toBe(
      "Use a valid time like 5:00.",
    );
  });
});
```

Replace with:
```ts
describe("validateReportInput", () => {
  it("returns valid when all report inputs are valid", () => {
    const result = validateReportInput({
      targetTime: "1:25:00",
      runs: initialRuns,
      stationSplits: initialStations,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.fieldErrors).toEqual({});
  });

  it("reports target, run and station errors", () => {
    const result = validateReportInput({
      targetTime: "1:99:00",
      runs: ["", ...initialRuns.slice(1)],
      stationSplits: {
        ...initialStations,
        wallBalls: "bad",
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Enter a valid target time, for example 1:25:00.",
    );
    expect(result.errors).toContain("Run 1 needs a valid time, for example 5:30.");
    expect(result.errors).toContain(
      "Wall balls needs a valid time, for example 5:00.",
    );
    expect(result.fieldErrors.targetTime).toBe(
      "Enter a valid target time, for example 1:25:00.",
    );
    expect(result.fieldErrors["run-0"]).toBe("Use a valid time like 5:30.");
    expect(result.fieldErrors["station-wallBalls"]).toBe(
      "Use a valid time like 5:00.",
    );
  });

  it("rejects a run split faster than physically possible", () => {
    const result = validateReportInput({
      targetTime: "1:25:00",
      runs: ["0:05", ...initialRuns.slice(1)],
      stationSplits: initialStations,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Run 1 is faster than physically possible — check this split.",
    );
    expect(result.fieldErrors["run-0"]).toBe(
      "That's faster than physically possible.",
    );
  });

  it("rejects a station split faster than physically possible", () => {
    const result = validateReportInput({
      targetTime: "1:25:00",
      runs: initialRuns,
      stationSplits: { ...initialStations, wallBalls: "0:05" },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Wall balls is faster than physically possible — check this split.",
    );
    expect(result.fieldErrors["station-wallBalls"]).toBe(
      "That's faster than physically possible.",
    );
  });

  it("uses a flat floor (not a distance-based one) for a custom format run", () => {
    const result = validateReportInput({
      targetTime: "1:25:00",
      runs: ["0:20"],
      stationSplits: {},
      stationDefinitions: [],
      raceFormat: "custom",
    });

    expect(result.errors).not.toContain(
      "Run 1 is faster than physically possible — check this split.",
    );
  });

  it("still rejects an outright-impossible run for a custom format", () => {
    const result = validateReportInput({
      targetTime: "1:25:00",
      runs: ["0:05"],
      stationSplits: {},
      stationDefinitions: [],
      raceFormat: "custom",
    });

    expect(result.errors).toContain(
      "Run 1 is faster than physically possible — check this split.",
    );
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run lib/validation.test.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add lib/validation.test.ts
git commit -m "Add plausibility floor tests for validateReportInput"
```

---

### Task 4: `lib/analysis.ts` — symmetric run benchmark, margin gate, confidence

**Files:**
- Modify: `lib/analysis.ts`

- [ ] **Step 1: Add `confidence` to `AthleteArchetype`**

Find:
```ts
export type AthleteArchetype = {
  id: string;
  label: string;
  tagline: string;
  description: string;
  scores: ArchetypeScores;
  traits: string[];
};
```

Replace with:
```ts
export type AthleteArchetype = {
  id: string;
  label: string;
  tagline: string;
  description: string;
  scores: ArchetypeScores;
  traits: string[];
  confidence: "low" | "medium" | "high";
};
```

- [ ] **Step 2: Add the private floor/confidence helpers**

Find:
```ts
function standardDeviation(values: number[]) {
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));

  return Math.sqrt(variance);
}
```

Replace with:
```ts
function standardDeviation(values: number[]) {
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));

  return Math.sqrt(variance);
}

// Local copies of lib/raceFormats.ts's runPaceSecPerKm/RaceFormatOption
// distances and lib/validation.ts's plausibility-floor formula — NOT
// imported, deliberately. lib/raceFormats.ts already imports `stations`
// from this file at module-evaluation time (to build raceFormatOptions),
// and lib/validation.ts already imports `stations`/`parseTime` from this
// file too. If this file imported the floor helpers back from either of
// those, it would create a circular module dependency that breaks at load
// time, not just lint. Keep these four values in sync with
// lib/raceFormats.ts's `runPaceSecPerKm`/`RaceFormatOption.runDistanceKm`
// and lib/validation.ts's FLAT_MIN_PLAUSIBLE_SECONDS/RUN_FLOOR_PACE_RATIO/
// STATION_FLOOR_RATIO if those ever change.
const ARCHETYPE_RUN_PACE_SEC_PER_KM: Record<Level, number> = {
  starter: 345,
  competitive: 280,
  elite: 235,
};
const ARCHETYPE_RUN_DISTANCE_KM: Partial<Record<RaceFormat, number>> = {
  hyrox: 1,
  tryka800: 0.8,
  tryka500: 0.5,
};
const FLAT_MIN_PLAUSIBLE_SECONDS = 12;
const RUN_FLOOR_PACE_RATIO = 0.5;
const STATION_FLOOR_RATIO = 0.5;
const NEAR_FLOOR_RATIO = 1.2;
const MIN_COMPARATIVE_MARGIN_SECONDS = 30;

function minPlausibleRunSeconds(raceFormat: RaceFormat): number {
  const distanceKm = ARCHETYPE_RUN_DISTANCE_KM[raceFormat];

  if (distanceKm == null) {
    return FLAT_MIN_PLAUSIBLE_SECONDS;
  }

  return Math.max(
    FLAT_MIN_PLAUSIBLE_SECONDS,
    Math.round(ARCHETYPE_RUN_PACE_SEC_PER_KM.elite * RUN_FLOOR_PACE_RATIO * distanceKm),
  );
}

function minPlausibleStationSeconds(
  station: Station,
  raceFormat: RaceFormat,
): number {
  if (raceFormat === "custom") {
    return FLAT_MIN_PLAUSIBLE_SECONDS;
  }

  return Math.max(
    FLAT_MIN_PLAUSIBLE_SECONDS,
    Math.round(station.benchmarkSec.elite * STATION_FLOOR_RATIO),
  );
}

function tierToConfidence(tier: number): AthleteArchetype["confidence"] {
  if (tier >= 2) {
    return "high";
  }

  return tier === 1 ? "medium" : "low";
}

// "Worst signal wins": near-floor data quality and (when relevant) how
// comfortably a comparative archetype's margin clears its minimum both map
// to a 0/1/2 tier, and the final confidence is the lower of the two. A
// report with clean data but a bare-minimum comparative margin should not
// read as fully confident, and vice versa.
function computeConfidence(
  nearFloorCount: number,
  comparativeMarginSeconds: number | null,
): AthleteArchetype["confidence"] {
  const nearFloorTier = nearFloorCount >= 3 ? 0 : nearFloorCount >= 1 ? 1 : 2;
  const marginTier =
    comparativeMarginSeconds == null
      ? 2
      : comparativeMarginSeconds >= MIN_COMPARATIVE_MARGIN_SECONDS * 2
        ? 2
        : 1;

  return tierToConfidence(Math.min(nearFloorTier, marginTier));
}
```

- [ ] **Step 3: Add `nearFloorCount` to `ArchetypeInputs`**

Find:
```ts
type ArchetypeInputs = {
  runFadeSeconds: number;
  runVolatilitySeconds: number;
  averageStationGap: number;
  stationLeakTotal: number;
  runLeakTotal: number;
  hasRoxzone: boolean;
  roxzonePercent: number;
  hasData: boolean;
};
```

Replace with:
```ts
type ArchetypeInputs = {
  runFadeSeconds: number;
  runVolatilitySeconds: number;
  averageStationGap: number;
  stationLeakTotal: number;
  runLeakTotal: number;
  hasRoxzone: boolean;
  roxzonePercent: number;
  hasData: boolean;
  nearFloorCount: number;
};
```

- [ ] **Step 4: Wire confidence through `buildArchetype`**

Find:
```ts
function buildArchetype({
  runFadeSeconds,
  runVolatilitySeconds,
  averageStationGap,
  stationLeakTotal,
  runLeakTotal,
  hasRoxzone,
  roxzonePercent,
  hasData,
}: ArchetypeInputs): AthleteArchetype {
  const scores: ArchetypeScores = {
    engine: clampScore(100 - runVolatilitySeconds * 2.4 - runFadeSeconds * 2),
    strength: clampScore(100 - averageStationGap * 1.15),
    durability: clampScore(100 - runFadeSeconds * 3.6),
    consistency: clampScore(100 - runVolatilitySeconds * 3),
  };

  if (!hasData) {
    return {
      id: "unscored",
      label: "Profile pending",
      tagline: "Add your splits",
      description:
        "Enter your run and station splits and Ocht will profile the kind of hybrid athlete your race data describes.",
      scores,
      traits: [],
    };
  }

  const pick = (
    id: string,
    label: string,
    tagline: string,
    description: string,
    traits: string[],
  ): AthleteArchetype => ({ id, label, tagline, description, scores, traits });
```

Replace with:
```ts
function buildArchetype({
  runFadeSeconds,
  runVolatilitySeconds,
  averageStationGap,
  stationLeakTotal,
  runLeakTotal,
  hasRoxzone,
  roxzonePercent,
  hasData,
  nearFloorCount,
}: ArchetypeInputs): AthleteArchetype {
  const scores: ArchetypeScores = {
    engine: clampScore(100 - runVolatilitySeconds * 2.4 - runFadeSeconds * 2),
    strength: clampScore(100 - averageStationGap * 1.15),
    durability: clampScore(100 - runFadeSeconds * 3.6),
    consistency: clampScore(100 - runVolatilitySeconds * 3),
  };

  if (!hasData) {
    return {
      id: "unscored",
      label: "Profile pending",
      tagline: "Add your splits",
      description:
        "Enter your run and station splits and Ocht will profile the kind of hybrid athlete your race data describes.",
      scores,
      traits: [],
      confidence: "low",
    };
  }

  const baselineConfidence = computeConfidence(nearFloorCount, null);

  const pick = (
    id: string,
    label: string,
    tagline: string,
    description: string,
    traits: string[],
    confidence: AthleteArchetype["confidence"] = baselineConfidence,
  ): AthleteArchetype => ({
    id,
    label,
    tagline,
    description,
    scores,
    traits,
    confidence,
  });
```

(Every existing call to `pick(...)` for the seven non-comparative archetypes — Morrígan, Setanta, Cú Chulainn, Brigid, Oisín, Lugh, Cormac — needs no changes: they all fall back to `baselineConfidence` via the new default parameter.)

- [ ] **Step 5: Add the margin gate to Fionn and Dagda**

Find:
```ts
  // Fionn mac Cumhaill — strong engine, stations the limiter
  if (stationLeakTotal > runLeakTotal * 1.4) {
    return pick(
      "fionn",
      "Fionn mac Cumhaill",
      "The run engine leads. The stations are the gap.",
      "Entry to the Fianna required a warrior to run at full pace through a dense forest without breaking a single twig underfoot or disturbing their braided hair. Fionn led this band of elite warrior-runners, and his ability across the ground was their standard. Your race shows the same quality: the runs carry you. The strength stations are where time is left behind. Strength-endurance work and station technique under fatigue are where your next gains live.",
      ["Strong run engine", "Station-limited", "Targets workout stations"],
    );
  }

  // The Dagda — strong stations, running is the limiter
  if (runLeakTotal > stationLeakTotal * 1.4) {
    return pick(
      "dagda",
      "The Dagda",
      "Immovable at the stations. The runs cost you.",
      "The Dagda was the father of the gods: enormous, immovable and endlessly powerful. He carried a club so heavy it had to be dragged on a cart, and his cauldron never ran empty. He was not built for grace or speed. He was built to endure and to outlast. Your stations show that same quality. The runs are where time slips away. Aerobic running volume and pacing discipline are your biggest opportunity.",
      ["Strong stations", "Run-limited", "Needs aerobic running base"],
    );
  }
```

Replace with:
```ts
  // Fionn mac Cumhaill — strong engine, stations the limiter
  const fionnMargin = stationLeakTotal - runLeakTotal;

  if (
    stationLeakTotal > runLeakTotal * 1.4 &&
    fionnMargin >= MIN_COMPARATIVE_MARGIN_SECONDS
  ) {
    return pick(
      "fionn",
      "Fionn mac Cumhaill",
      "The run engine leads. The stations are the gap.",
      "Entry to the Fianna required a warrior to run at full pace through a dense forest without breaking a single twig underfoot or disturbing their braided hair. Fionn led this band of elite warrior-runners, and his ability across the ground was their standard. Your race shows the same quality: the runs carry you. The strength stations are where time is left behind. Strength-endurance work and station technique under fatigue are where your next gains live.",
      ["Strong run engine", "Station-limited", "Targets workout stations"],
      computeConfidence(nearFloorCount, fionnMargin),
    );
  }

  // The Dagda — strong stations, running is the limiter
  const dagdaMargin = runLeakTotal - stationLeakTotal;

  if (
    runLeakTotal > stationLeakTotal * 1.4 &&
    dagdaMargin >= MIN_COMPARATIVE_MARGIN_SECONDS
  ) {
    return pick(
      "dagda",
      "The Dagda",
      "Immovable at the stations. The runs cost you.",
      "The Dagda was the father of the gods: enormous, immovable and endlessly powerful. He carried a club so heavy it had to be dragged on a cart, and his cauldron never ran empty. He was not built for grace or speed. He was built to endure and to outlast. Your stations show that same quality. The runs are where time slips away. Aerobic running volume and pacing discipline are your biggest opportunity.",
      ["Strong stations", "Run-limited", "Needs aerobic running base"],
      computeConfidence(nearFloorCount, dagdaMargin),
    );
  }
```

- [ ] **Step 6: Compute the symmetric run benchmark and `nearFloorCount` in `buildAnalysis`**

Find:
```ts
  const stationLeakTotal = orderedStationResults.reduce(
    (total, station) => total + station.gap,
    0,
  );
  const runLeakTotal = runFadeSeconds * 4 + runVolatilitySeconds * 3.2;
  const archetype = buildArchetype({
    runFadeSeconds,
    runVolatilitySeconds,
    averageStationGap: stationLeakTotal / stationCount,
    stationLeakTotal,
    runLeakTotal,
    hasRoxzone,
    roxzonePercent,
    hasData: finishSeconds > 0,
  });
```

Replace with:
```ts
  const stationLeakTotal = orderedStationResults.reduce(
    (total, station) => total + station.gap,
    0,
  );
  const archetypeRunDistanceKm = ARCHETYPE_RUN_DISTANCE_KM[raceFormat];
  const runBenchmarkSeconds =
    archetypeRunDistanceKm == null
      ? null
      : ARCHETYPE_RUN_PACE_SEC_PER_KM[level] * archetypeRunDistanceKm;
  const runGapTotal =
    runBenchmarkSeconds == null
      ? null
      : runSeconds.reduce(
          (total, seconds) => total + Math.max(0, seconds - runBenchmarkSeconds),
          0,
        );
  // For a custom format (no fixed run distance), there's no external
  // benchmark to compare against, so the run side of the Fionn/Dagda
  // comparison falls back to the old self-relative fade+volatility measure
  // — the only signal available without a real distance to anchor to.
  const runLeakTotal = runGapTotal ?? runFadeSeconds * 4 + runVolatilitySeconds * 3.2;
  const runFloorSeconds = minPlausibleRunSeconds(raceFormat);
  const nearFloorRunCount = runSeconds.filter(
    (seconds) => seconds <= runFloorSeconds * NEAR_FLOOR_RATIO,
  ).length;
  const nearFloorStationCount = orderedStationResults.filter(
    (station) =>
      station.seconds <=
      minPlausibleStationSeconds(station, raceFormat) * NEAR_FLOOR_RATIO,
  ).length;
  const nearFloorCount = nearFloorRunCount + nearFloorStationCount;
  const archetype = buildArchetype({
    runFadeSeconds,
    runVolatilitySeconds,
    averageStationGap: stationLeakTotal / stationCount,
    stationLeakTotal,
    runLeakTotal,
    hasRoxzone,
    roxzonePercent,
    hasData: finishSeconds > 0,
    nearFloorCount,
  });
```

- [ ] **Step 7: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Run the existing analysis tests**

Run: `npx vitest run lib/analysis.test.ts`
Expected: all pass unchanged — verified by hand in this plan's "Confirmed deviations" section above (the Fionn test's real numbers clear both the ratio and the new margin; the other three tests never reach the Fionn/Dagda branches or don't touch anything this task changed).

- [ ] **Step 9: Commit**

```bash
git add lib/analysis.ts
git commit -m "Add symmetric run benchmark, comparative margin gate, and archetype confidence"
```

---

### Task 5: `lib/analysis.test.ts` — new tests for the fix

**Files:**
- Modify: `lib/analysis.test.ts`

- [ ] **Step 1: Add the tests**

Find:
```ts
  it("keeps every archetype score within 0-100", () => {
    const analysis = buildAnalysis(
      "Score bounds",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
    );

    (["engine", "strength", "durability", "consistency"] as const).forEach(
      (key) => {
        expect(analysis.archetype.scores[key]).toBeGreaterThanOrEqual(0);
        expect(analysis.archetype.scores[key]).toBeLessThanOrEqual(100);
      },
    );
  });
});
```

Replace with:
```ts
  it("keeps every archetype score within 0-100", () => {
    const analysis = buildAnalysis(
      "Score bounds",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
    );

    (["engine", "strength", "durability", "consistency"] as const).forEach(
      (key) => {
        expect(analysis.archetype.scores[key]).toBeGreaterThanOrEqual(0);
        expect(analysis.archetype.scores[key]).toBeLessThanOrEqual(100);
      },
    );
  });

  it("does not classify a comparative archetype from near-floor placeholder splits, and marks confidence low", () => {
    const nearFloorRuns = Array.from({ length: 8 }, () => "0:15");
    const nearFloorStations: Record<StationKey, string> = {
      ski: "0:15",
      sledPush: "0:15",
      sledPull: "0:15",
      burpees: "0:15",
      row: "0:15",
      farmers: "0:15",
      lunges: "0:15",
      wallBalls: "0:15",
    };
    const analysis = buildAnalysis(
      "Test data",
      "1:00:00",
      "competitive",
      nearFloorRuns,
      nearFloorStations,
    );

    expect(analysis.archetype.id).not.toBe("fionn");
    expect(analysis.archetype.id).not.toBe("dagda");
    expect(analysis.archetype.confidence).toBe("low");
  });

  it("does not classify a comparative archetype when the leak margin is under the minimum threshold", () => {
    const runs = [
      "4:40",
      "4:40",
      "4:40",
      "4:40",
      "4:40",
      "4:40",
      "4:40",
      "4:55",
    ];
    const marginStationSplits: Record<StationKey, string> = {
      ski: "4:40",
      sledPush: "4:45",
      sledPull: "5:00",
      burpees: "5:30",
      row: "4:20",
      farmers: "3:30",
      lunges: "5:00",
      wallBalls: "6:00",
    };
    const analysis = buildAnalysis(
      "Thin margin",
      "1:20:00",
      "competitive",
      runs,
      marginStationSplits,
    );

    expect(analysis.archetype.id).not.toBe("fionn");
    expect(analysis.archetype.id).not.toBe("dagda");
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run lib/analysis.test.ts`
Expected: all pass, including the two new ones.

Both new cases were verified by hand while writing this plan:
- Near-floor case: every split is far below its benchmark (15s vs. a 280s run benchmark, vs. station benchmarks of 210–360s), so both `stationLeakTotal` and `runGapTotal` are 0 — neither comparative gate's ratio check (`0 > 0 * 1.4`) is even true, so it falls through to Lugh (durability/consistency both 100, since every split is identical). `nearFloorCount` is 16 (every split sits far under `floor * 1.2`), giving `computeConfidence(16, null)` → `"low"`.
- Thin-margin case: `stationLeakTotal = 25` (one station, `ski`, 25s over its competitive benchmark of 255s; every other station exactly at benchmark), new `runLeakTotal = 15` (one run at 295s vs. the 280s competitive run benchmark; the other seven exactly at benchmark) — the ratio (`25 > 15 * 1.4 = 21`) is true, matching the *old* behavior, but the margin (`25 - 15 = 10`) is under the new 30s minimum, so Fionn does not fire. The single differing run/station isn't enough to trip Setanta/Cú Chulainn/Brigid/Oisín's earlier thresholds (durability ≈86.5, consistency ≈85.1), so it falls through to Lugh.

- [ ] **Step 3: Commit**

```bash
git add lib/analysis.test.ts
git commit -m "Add tests for the archetype comparison's floor and margin gates"
```

---

### Task 6: `app/app/page.tsx` — pass `raceFormat` into client-side validation

**Files:**
- Modify: `app/app/page.tsx`

- [ ] **Step 1: Add `raceFormat` to the `validateReportInput` call**

Find:
```ts
    const validation = validateReportInput({
      targetTime,
      runs,
      stationSplits,
      stationDefinitions: activeStationDefinitions,
    });
```

Replace with:
```ts
    const validation = validateReportInput({
      targetTime,
      runs,
      stationSplits,
      stationDefinitions: activeStationDefinitions,
      raceFormat,
    });
```

- [ ] **Step 2: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors — `raceFormat` is already in scope as component state in this file.

- [ ] **Step 3: Commit**

```bash
git add app/app/page.tsx
git commit -m "Pass raceFormat into manual-entry validation"
```

---

### Task 7: `app/api/reports/route.ts` — pass `raceFormat` into server-side validation

**Files:**
- Modify: `app/api/reports/route.ts`

- [ ] **Step 1: Add `raceFormat` to the `validateReportInput` call**

Find:
```ts
  const timeValidation = validateReportInput({
    targetTime,
    runs,
    stationSplits,
    stationDefinitions,
  });
```

Replace with:
```ts
  const timeValidation = validateReportInput({
    targetTime,
    runs,
    stationSplits,
    stationDefinitions,
    raceFormat,
  });
```

- [ ] **Step 2: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors — `raceFormat` is already resolved earlier in `parseReportPayload`.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all pass — this endpoint has no dedicated test file (confirmed: `app/api/reports/` contains no `*.test.ts`), so this is purely a regression check on the rest of the suite.

- [ ] **Step 4: Commit**

```bash
git add app/api/reports/route.ts
git commit -m "Pass raceFormat into server-side report validation"
```

---

### Task 8: `components/AthleteArchetypeCard.tsx` — show confidence

**Files:**
- Modify: `components/AthleteArchetypeCard.tsx`
- Modify: `styles/_report.scss`

- [ ] **Step 1: Render the confidence line**

Find:
```tsx
        <div>
          <p className="archetype-card__eyebrow">Athlete archetype</p>
          <h3 className="archetype-card__name">{archetype.label}</h3>
          <p className="archetype-card__tagline">{archetype.tagline}</p>
        </div>
```

Replace with:
```tsx
        <div>
          <p className="archetype-card__eyebrow">Athlete archetype</p>
          <h3 className="archetype-card__name">{archetype.label}</h3>
          <p className="archetype-card__confidence">
            {archetype.confidence} confidence
          </p>
          <p className="archetype-card__tagline">{archetype.tagline}</p>
        </div>
```

- [ ] **Step 2: Add the style**

Find (in `styles/_report.scss`):
```scss
.archetype-card__tagline {
  margin: 4px 0 0;
  font-family: var(--font-mono), var(--font-body), monospace;
  font-size: 0.74rem;
  letter-spacing: 0.04em;
```

Add immediately before that block (same indentation level, i.e. before `.archetype-card__tagline {`):
```scss
.archetype-card__confidence {
  margin: 2px 0 0;
  font-family: var(--font-mono), var(--font-body), monospace;
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

```

- [ ] **Step 3: Verify types check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/AthleteArchetypeCard.tsx styles/_report.scss
git commit -m "Show archetype confidence on the archetype card"
```

---

### Task 9: `components/ResultsReveal.tsx` — show confidence

**Files:**
- Modify: `components/ResultsReveal.tsx`
- Modify: `styles/_report.scss`

- [ ] **Step 1: Render the confidence line**

Find:
```tsx
            <button
              className="results-reveal__panel results-reveal__panel--clickable"
              type="button"
              onClick={onViewArchetype}
            >
              <span>Athlete archetype</span>
              <strong>{archetype.label}</strong>
              <em>{archetype.tagline}</em>
            </button>
```

Replace with:
```tsx
            <button
              className="results-reveal__panel results-reveal__panel--clickable"
              type="button"
              onClick={onViewArchetype}
            >
              <span>Athlete archetype</span>
              <strong>{archetype.label}</strong>
              <small className="results-reveal__confidence">
                {archetype.confidence} confidence
              </small>
              <em>{archetype.tagline}</em>
            </button>
```

- [ ] **Step 2: Add the style**

Find (in `styles/_report.scss`):
```scss
.results-reveal__panel em {
  color: var(--muted);
  font-size: 0.8rem;
  font-style: normal;
}
```

Add immediately after that block:
```scss

.results-reveal__panel .results-reveal__confidence {
  margin: 2px 0 0;
  font-size: 0.7rem;
  color: var(--muted);
}
```

(The extra specificity from `.results-reveal__panel .results-reveal__confidence`, rather than a bare `.results-reveal__confidence`, is deliberate — `.results-reveal__panel span` earlier in this same file is a small-caps mono eyebrow style meant for the "Athlete archetype"/"Biggest leak" labels, and would otherwise leak onto this new element too since `small` is not `span` but any future rename to a bare class needs to out-specify that selector.)

- [ ] **Step 3: Verify types check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/ResultsReveal.tsx styles/_report.scss
git commit -m "Show archetype confidence on the results reveal"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, no regressions.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds, no type or lint errors.

- [ ] **Step 3: Manual browser pass**

Run: `npm run dev`, then in a browser:

1. Submit a manual report (`/app`) with a `0:00`/impossible split for one run and one station — confirm the new "faster than physically possible" error appears for both fields and the report does not generate.
2. Submit a normal, realistic report — confirm it still generates exactly as before, and the archetype card shows a confidence line ("high confidence" for clean data) without looking out of place.
3. Check the initial results-reveal screen (right after generating a report) also shows the confidence line under the archetype panel.
4. Confirm light and dark theme both render the new confidence text legibly (it uses `var(--muted)`, already theme-aware).

Stop the dev server when done.

- [ ] **Step 4: Confirm clean working tree**

Run: `git status`
Expected: clean.
