# HYROX Pacing Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/hyrox-pacing-calculator`, a public no-login page where a visitor enters a target finish time, level, and format (HYROX/TRYKA), and gets three split-by-split pacing plans (Balanced / Run-focused / Station-focused) that sum exactly to that target — usable by both anonymous visitors and signed-in users, with CTA copy that adapts to auth state.

**Architecture:** A pure calculation module (`lib/pacingPredictor.ts`) computes the three scenarios from existing `lib/raceFormats.ts` station benchmarks plus a new run-pace-per-level constant. A client component (`components/PacingCalculator.tsx`) owns the form state, calls the predictor, and renders results — reusing the existing `.format-picker`/`.format-card`, `.field`/`.input-row`, and time-masking (`maskTimeInput`/`normalizeTimeInput`) patterns already used by `SplitForm.tsx`, so no new input styling is needed. A thin server component page (`app/hyrox-pacing-calculator/page.tsx`) supplies SEO metadata and mounts the client component, following the exact pattern of `app/what-is-hyrox/page.tsx`.

**Tech Stack:** Next.js 15 App Router, TypeScript, SCSS (existing `styles/_forms.scss` classes reused, one new partial for scenario-table/tabs styling), Vitest for `lib/pacingPredictor.ts` tests.

**Full spec:** `docs/superpowers/specs/2026-08-14-pacing-calculator-design.md`

---

### Task 1: Run-pace benchmark constant

**Files:**
- Modify: `lib/raceFormats.ts`

- [ ] **Step 1: Add the `runPaceSecPerKm` constant**

Add this export near the top of `lib/raceFormats.ts`, after the `RaceFormat` type export (after line 4):

```ts
// Baseline running pace per level, seconds per km, at a controlled
// race-day effort (not a max-effort standalone 1km time). Used only by
// the pacing predictor (lib/pacingPredictor.ts) to project a plan for
// someone who hasn't raced yet — real races always use actual splits
// instead of this baseline.
export const runPaceSecPerKm: Record<Level, number> = {
  starter: 345,
  competitive: 280,
  elite: 235,
};
```

This needs the `Level` type. Update the existing import line at the top of the file from:

```ts
import type { Station, StationKey } from "./analysis";
```

to:

```ts
import type { Level, Station, StationKey } from "./analysis";
```

- [ ] **Step 2: Verify types check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/raceFormats.ts
git commit -m "Add run-pace-per-level baseline for the pacing predictor"
```

---

### Task 2: Pacing predictor calculation module

**Files:**
- Create: `lib/pacingPredictor.ts`
- Create: `lib/pacingPredictor.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/pacingPredictor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPacingScenarios } from "./pacingPredictor";
import { parseTime } from "./analysis";

describe("buildPacingScenarios", () => {
  it("all three scenarios sum to exactly the target time, for every format and level", () => {
    const targets = [parseTime("1:15:00"), parseTime("1:45:00")];
    const formats = ["hyrox", "tryka800", "tryka500"] as const;
    const levels = ["starter", "competitive", "elite"] as const;

    for (const targetSeconds of targets) {
      for (const raceFormat of formats) {
        for (const level of levels) {
          const scenarios = buildPacingScenarios({ targetSeconds, level, raceFormat });

          for (const scenario of scenarios) {
            const total = scenario.segments.reduce((sum, seg) => sum + seg.seconds, 0);
            expect(Math.round(total)).toBe(targetSeconds);
          }
        }
      }
    }
  });

  it("returns balanced, run-focused, and station-focused scenarios in that order", () => {
    const scenarios = buildPacingScenarios({
      targetSeconds: parseTime("1:15:00"),
      level: "competitive",
      raceFormat: "hyrox",
    });

    expect(scenarios.map((s) => s.id)).toEqual(["balanced", "run-focused", "station-focused"]);
  });

  it("run-focused scenario has faster (lower-seconds) run segments than balanced", () => {
    const [balanced, runFocused] = buildPacingScenarios({
      targetSeconds: parseTime("1:15:00"),
      level: "competitive",
      raceFormat: "hyrox",
    });

    const balancedRunTotal = balanced.segments
      .filter((s) => s.type === "run")
      .reduce((sum, s) => sum + s.seconds, 0);
    const runFocusedRunTotal = runFocused.segments
      .filter((s) => s.type === "run")
      .reduce((sum, s) => sum + s.seconds, 0);

    expect(runFocusedRunTotal).toBeLessThan(balancedRunTotal);
  });

  it("station-focused scenario has faster (lower-seconds) station segments than balanced", () => {
    const [balanced, , stationFocused] = buildPacingScenarios({
      targetSeconds: parseTime("1:15:00"),
      level: "competitive",
      raceFormat: "hyrox",
    });

    const balancedStationTotal = balanced.segments
      .filter((s) => s.type === "station")
      .reduce((sum, s) => sum + s.seconds, 0);
    const stationFocusedStationTotal = stationFocused.segments
      .filter((s) => s.type === "station")
      .reduce((sum, s) => sum + s.seconds, 0);

    expect(stationFocusedStationTotal).toBeLessThan(balancedStationTotal);
  });

  it("each scenario has 8 run segments and 8 station segments for hyrox", () => {
    const scenarios = buildPacingScenarios({
      targetSeconds: parseTime("1:15:00"),
      level: "competitive",
      raceFormat: "hyrox",
    });

    for (const scenario of scenarios) {
      expect(scenario.segments.filter((s) => s.type === "run")).toHaveLength(8);
      expect(scenario.segments.filter((s) => s.type === "station")).toHaveLength(8);
    }
  });

  it("segments are labeled and in race order (run, station, run, station...)", () => {
    const [balanced] = buildPacingScenarios({
      targetSeconds: parseTime("1:15:00"),
      level: "competitive",
      raceFormat: "hyrox",
    });

    const types = balanced.segments.map((s) => s.type);
    expect(types).toEqual([
      "run", "station", "run", "station", "run", "station", "run", "station",
      "run", "station", "run", "station", "run", "station", "run", "station",
    ]);
    expect(balanced.segments[0].label).toBe("Run 1");
    expect(balanced.segments[1].label).toBe("SkiErg");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/pacingPredictor.test.ts`
Expected: FAIL with "Cannot find module './pacingPredictor'" (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/pacingPredictor.ts`:

```ts
import { Level, formatTime } from "./analysis";
import { RaceFormat, getRaceFormatOption, runPaceSecPerKm } from "./raceFormats";
import { getRunDistanceKm } from "./units";

export type PacingSegment = {
  id: string;
  label: string;
  type: "run" | "station";
  seconds: number;
};

export type PacingScenario = {
  id: "balanced" | "run-focused" | "station-focused";
  label: string;
  note: string;
  segments: PacingSegment[];
  totalSeconds: number;
  totalLabel: string;
};

export type PacingScenarioInput = {
  targetSeconds: number;
  level: Level;
  raceFormat: RaceFormat;
};

const RUN_LEG_COUNT = 8;

function buildSegments(
  raceFormat: RaceFormat,
  runSecondsPerLeg: number,
  stationScale: number,
  level: Level,
): PacingSegment[] {
  const format = getRaceFormatOption(raceFormat);
  const segments: PacingSegment[] = [];

  for (let i = 0; i < RUN_LEG_COUNT; i++) {
    segments.push({
      id: `run-${i + 1}`,
      label: `Run ${i + 1}`,
      type: "run",
      seconds: runSecondsPerLeg,
    });

    const station = format.stations[i];
    if (station) {
      segments.push({
        id: `station-${station.key}`,
        label: station.label,
        type: "station",
        seconds: station.benchmarkSec[level] * stationScale,
      });
    }
  }

  return segments;
}

function scenarioTotal(segments: PacingSegment[]): number {
  return segments.reduce((sum, seg) => sum + seg.seconds, 0);
}

export function buildPacingScenarios({
  targetSeconds,
  level,
  raceFormat,
}: PacingScenarioInput): PacingScenario[] {
  const format = getRaceFormatOption(raceFormat);
  const legDistanceKm = getRunDistanceKm(raceFormat);
  const runBenchmarkPerLeg = runPaceSecPerKm[level] * legDistanceKm;
  const runBenchmarkTotal = runBenchmarkPerLeg * RUN_LEG_COUNT;
  const stationBenchmarkTotal = format.stations.reduce(
    (sum, station) => sum + station.benchmarkSec[level],
    0,
  );
  const baselineTotal = runBenchmarkTotal + stationBenchmarkTotal;

  // Balanced: uniform scale across every run and station.
  const balancedScale = targetSeconds / baselineTotal;
  const balancedRunPerLeg = runBenchmarkPerLeg * balancedScale;
  const balancedSegments = buildSegments(raceFormat, balancedRunPerLeg, balancedScale, level);

  // Run-focused: runs 10% faster than balanced; stations absorb the rest.
  const runFocusedRunPerLeg = balancedRunPerLeg * 0.9;
  const runFocusedRunTotal = runFocusedRunPerLeg * RUN_LEG_COUNT;
  const runFocusedStationScale =
    (targetSeconds - runFocusedRunTotal) / stationBenchmarkTotal;
  const runFocusedSegments = buildSegments(
    raceFormat,
    runFocusedRunPerLeg,
    runFocusedStationScale,
    level,
  );

  // Station-focused: stations 10% faster than balanced; runs absorb the rest.
  const stationFocusedScale = balancedScale * 0.9;
  const stationFocusedStationTotal = stationBenchmarkTotal * stationFocusedScale;
  const stationFocusedRunPerLeg =
    (targetSeconds - stationFocusedStationTotal) / RUN_LEG_COUNT;
  const stationFocusedSegments = buildSegments(
    raceFormat,
    stationFocusedRunPerLeg,
    stationFocusedScale,
    level,
  );

  return [
    {
      id: "balanced",
      label: "Balanced",
      note: `Every station and run scaled by the same factor from your ${format.label} benchmark — assumes fairly even strength across running and stations.`,
      segments: balancedSegments,
      totalSeconds: scenarioTotal(balancedSegments),
      totalLabel: formatTime(scenarioTotal(balancedSegments)),
    },
    {
      id: "run-focused",
      label: "Run-focused",
      note: "Runs paced faster than balanced, stations carry the rest of the budget — for athletes whose running is ahead of their station strength.",
      segments: runFocusedSegments,
      totalSeconds: scenarioTotal(runFocusedSegments),
      totalLabel: formatTime(scenarioTotal(runFocusedSegments)),
    },
    {
      id: "station-focused",
      label: "Station-focused",
      note: "Stations paced faster than balanced, runs carry the rest of the budget — for athletes whose station strength is ahead of their running.",
      segments: stationFocusedSegments,
      totalSeconds: scenarioTotal(stationFocusedSegments),
      totalLabel: formatTime(scenarioTotal(stationFocusedSegments)),
    },
  ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/pacingPredictor.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/pacingPredictor.ts lib/pacingPredictor.test.ts
git commit -m "Add pacing predictor calculation module"
```

---

### Task 3: `PacingCalculator` client component — form + balanced scenario

**Files:**
- Create: `components/PacingCalculator.tsx`

This task builds the form (target time, level, format picker) and renders the Balanced scenario only. Task 4 adds the scenario tabs and the other two scenarios. Task 5 adds the auth-aware CTA.

- [ ] **Step 1: Write the component**

Create `components/PacingCalculator.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Level, levelLabels } from "@/lib/analysis";
import { buildPacingScenarios, PacingScenario } from "@/lib/pacingPredictor";
import { RaceFormat, raceFormatOptions } from "@/lib/raceFormats";
import { maskTimeInput, normalizeTimeInput } from "@/lib/validation";
import { parseTime } from "@/lib/analysis";

const DEFAULT_TARGET_TIME = "1:15:00";
const DEFAULT_LEVEL: Level = "competitive";
const DEFAULT_FORMAT: RaceFormat = "hyrox";

export function PacingCalculator() {
  const [targetTime, setTargetTime] = useState(DEFAULT_TARGET_TIME);
  const [level, setLevel] = useState<Level>(DEFAULT_LEVEL);
  const [raceFormat, setRaceFormat] = useState<RaceFormat>(DEFAULT_FORMAT);

  const targetSeconds = parseTime(targetTime);

  const scenarios: PacingScenario[] = useMemo(() => {
    if (targetSeconds <= 0) {
      return [];
    }

    return buildPacingScenarios({ targetSeconds, level, raceFormat });
  }, [targetSeconds, level, raceFormat]);

  const balanced = scenarios[0];

  return (
    <div className="pacing-calculator">
      <div className="pacing-calculator__controls">
        <label className="field">
          <span>Target finish time</span>
          <input
            value={targetTime}
            onChange={(event) => setTargetTime(maskTimeInput(event.target.value, "race"))}
            onBlur={(event) => setTargetTime(normalizeTimeInput(event.target.value, "race"))}
            inputMode="numeric"
            placeholder="1:15:00"
          />
        </label>

        <label className="field">
          <span>Athlete level</span>
          <select value={level} onChange={(event) => setLevel(event.target.value as Level)}>
            {Object.entries(levelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="scroll-fade-wrap format-picker-wrap">
          <div className="format-picker" aria-label="Race format">
            {raceFormatOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={option.id === raceFormat ? "format-card is-active" : "format-card"}
                onClick={() => setRaceFormat(option.id)}
              >
                <span className="format-card__name">{option.label}</span>
                <span className="format-card__sub">
                  {option.runLabel} · {option.stations.length} rounds
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {balanced ? (
        <div className="pacing-calculator__scenario">
          <p className="pacing-calculator__note">{balanced.note}</p>
          <div className="pacing-calculator__grid">
            {balanced.segments.map((segment) => (
              <div className="pacing-calculator__row" key={segment.id}>
                <span>{segment.label}</span>
                <span>{formatSegmentTime(segment.seconds)}</span>
              </div>
            ))}
          </div>
          <div className="pacing-calculator__total">
            <span>Projected finish</span>
            <span>{balanced.totalLabel}</span>
          </div>
        </div>
      ) : (
        <p className="pacing-calculator__empty">Enter a target finish time to build a plan.</p>
      )}
    </div>
  );
}

function formatSegmentTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
```

- [ ] **Step 2: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors. (Component isn't mounted anywhere yet — this only catches syntax/type mistakes.)

- [ ] **Step 3: Commit**

```bash
git add components/PacingCalculator.tsx
git commit -m "Add PacingCalculator component with balanced scenario"
```

---

### Task 4: Scenario tabs — run-focused and station-focused

**Files:**
- Modify: `components/PacingCalculator.tsx`

- [ ] **Step 1: Add scenario-tab state and switch the rendered scenario**

In `components/PacingCalculator.tsx`, replace the `const balanced = scenarios[0];` line and the JSX block that renders it with:

```tsx
  const [activeScenarioId, setActiveScenarioId] = useState<PacingScenario["id"]>("balanced");
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0];
```

(Add this right after the `const scenarios = useMemo(...)` block, replacing the old `const balanced = scenarios[0];` line.)

Then replace the JSX rendering block:

```tsx
      {balanced ? (
        <div className="pacing-calculator__scenario">
          <p className="pacing-calculator__note">{balanced.note}</p>
          <div className="pacing-calculator__grid">
            {balanced.segments.map((segment) => (
              <div className="pacing-calculator__row" key={segment.id}>
                <span>{segment.label}</span>
                <span>{formatSegmentTime(segment.seconds)}</span>
              </div>
            ))}
          </div>
          <div className="pacing-calculator__total">
            <span>Projected finish</span>
            <span>{balanced.totalLabel}</span>
          </div>
        </div>
      ) : (
        <p className="pacing-calculator__empty">Enter a target finish time to build a plan.</p>
      )}
```

with:

```tsx
      {activeScenario ? (
        <>
          <div className="pacing-calculator__tabs" role="tablist" aria-label="Pacing strategy">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                role="tab"
                aria-selected={scenario.id === activeScenario.id}
                className={
                  scenario.id === activeScenario.id
                    ? "pacing-calculator__tab is-active"
                    : "pacing-calculator__tab"
                }
                onClick={() => setActiveScenarioId(scenario.id)}
              >
                {scenario.label}
              </button>
            ))}
          </div>

          <div className="pacing-calculator__scenario">
            <p className="pacing-calculator__note">{activeScenario.note}</p>
            <div className="pacing-calculator__grid">
              {activeScenario.segments.map((segment) => (
                <div className="pacing-calculator__row" key={segment.id}>
                  <span>{segment.label}</span>
                  <span>{formatSegmentTime(segment.seconds)}</span>
                </div>
              ))}
            </div>
            <div className="pacing-calculator__total">
              <span>Projected finish</span>
              <span>{activeScenario.totalLabel}</span>
            </div>
          </div>
        </>
      ) : (
        <p className="pacing-calculator__empty">Enter a target finish time to build a plan.</p>
      )}
```

- [ ] **Step 2: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/PacingCalculator.tsx
git commit -m "Add scenario tabs to PacingCalculator"
```

---

### Task 5: Auth-aware CTA

**Files:**
- Create: `lib/pacingCta.ts`
- Create: `lib/pacingCta.test.ts`
- Modify: `components/PacingCalculator.tsx`

The signed-in/signed-out CTA copy is pulled out into a pure function so it can be unit tested without a browser/DOM — the project's Vitest setup runs in Node with no jsdom or `@testing-library/react` installed, so React components themselves aren't unit-testable, but plain functions are (matches the existing `lib/progress.ts`-style separation of logic from presentation).

- [ ] **Step 1: Write the failing test**

Create `lib/pacingCta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPacingCtaContent } from "./pacingCta";

describe("getPacingCtaContent", () => {
  it("prompts sign-up when signed out", () => {
    const content = getPacingCtaContent(false);
    expect(content.buttonLabel).toBe("Sign up free");
    expect(content.buttonHref).toBe("/app?auth=signup");
    expect(content.body).toContain("Sign up free");
  });

  it("prompts logging splits when signed in", () => {
    const content = getPacingCtaContent(true);
    expect(content.buttonLabel).toBe("Log my splits");
    expect(content.buttonHref).toBe("/app");
    expect(content.body).not.toContain("Sign up");
  });

  it("treats unknown (null) auth state the same as signed out", () => {
    const content = getPacingCtaContent(null);
    expect(content.buttonLabel).toBe("Sign up free");
    expect(content.buttonHref).toBe("/app?auth=signup");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/pacingCta.test.ts`
Expected: FAIL with "Cannot find module './pacingCta'".

- [ ] **Step 3: Write the implementation**

Create `lib/pacingCta.ts`:

```ts
export type PacingCtaContent = {
  heading: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
};

export function getPacingCtaContent(signedIn: boolean | null): PacingCtaContent {
  if (signedIn) {
    return {
      heading: "Now go run it.",
      body: "Log your real splits after training or racing and Ocht will show you exactly where this plan held up — and where it didn't.",
      buttonLabel: "Log my splits",
      buttonHref: "/app",
    };
  }

  return {
    heading: "Now go run it.",
    body: "Sign up free to save this plan and compare it against your real splits once you've raced or trained against it.",
    buttonLabel: "Sign up free",
    buttonHref: "/app?auth=signup",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/pacingCta.test.ts`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Wire it into the component**

In `components/PacingCalculator.tsx`, add `useEffect` to the React import:

```tsx
import { useEffect, useMemo, useState } from "react";
```

Add the `getPacingCtaContent` import:

```tsx
import { getPacingCtaContent } from "@/lib/pacingCta";
```

Add this state, effect, and derived content right after the `activeScenario` line added in Task 4:

```tsx
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json() as Promise<{ user: unknown }>)
      .then((data) => setSignedIn(Boolean(data.user)))
      .catch(() => setSignedIn(false));
  }, []);

  const cta = getPacingCtaContent(signedIn);
```

Add the CTA band as the last element inside the component's returned `<div className="pacing-calculator">`, right after the closing of the scenario/empty-state conditional block (i.e. as the final child before the outer `</div>`):

```tsx
      <div className="pacing-calculator__cta">
        <h2>{cta.heading}</h2>
        <p>{cta.body}</p>
        <a className="btn btn--primary btn--lg" href={cta.buttonHref}>
          {cta.buttonLabel}
        </a>
      </div>
```

- [ ] **Step 6: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/pacingCta.ts lib/pacingCta.test.ts components/PacingCalculator.tsx
git commit -m "Add auth-aware CTA to PacingCalculator"
```

---

### Task 6: Styles for the new component

**Files:**
- Create: `styles/_pacing-calculator.scss`
- Modify: `app/globals.scss:19` (add the new `@use` line)

- [ ] **Step 1: Create the SCSS partial**

```scss
// styles/_pacing-calculator.scss
// Styles for the /hyrox-pacing-calculator predictor page. Reuses
// .field/.input-row/.format-picker/.format-card from _forms.scss for
// the input controls — this partial only covers the parts unique to
// this page: scenario tabs, the split-plan grid, and the CTA band.

.pacing-calculator {
  max-width: 52rem;
  margin: 0 auto;
  padding: 0 48px 56px;
}

.pacing-calculator__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-end;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 28px;
  margin-bottom: 24px;
}

.pacing-calculator__tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 0;
}

.pacing-calculator__tab {
  width: auto;
  min-height: 0;
  margin-top: 0;
  padding: 10px 18px;
  border: 1px solid var(--line);
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
}

.pacing-calculator__tab.is-active {
  background: var(--surface);
  color: var(--ink);
  font-weight: 700;
}

.pacing-calculator__scenario {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 0 10px 10px 10px;
  padding: 28px;
  margin-bottom: 48px;
}

.pacing-calculator__note {
  font-size: 0.85rem;
  color: var(--muted);
  max-width: 44rem;
  margin: 0 0 20px;
}

.pacing-calculator__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 32px;
}

.pacing-calculator__row {
  display: flex;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid var(--line);
  font-size: 0.88rem;
}

.pacing-calculator__row span:first-child {
  color: var(--muted);
}

.pacing-calculator__row span:last-child {
  font-family: var(--font-mono);
  color: var(--ink);
  font-weight: 600;
}

.pacing-calculator__total {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 2px solid var(--lime);
  font-size: 1rem;
}

.pacing-calculator__total span:last-child {
  color: var(--lime);
  font-family: var(--font-mono);
  font-weight: 800;
}

.pacing-calculator__empty {
  color: var(--muted);
  padding: 28px;
  text-align: center;
}

.pacing-calculator__cta {
  text-align: center;
  padding: 32px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: radial-gradient(
    ellipse 100% 100% at 50% 0%,
    var(--accent-soft),
    transparent
  );
}

.pacing-calculator__cta h2 {
  font-family: var(--font-display);
  margin: 0 0 8px;
  font-size: 1.4rem;
}

.pacing-calculator__cta p {
  color: var(--muted);
  margin: 0 0 20px;
}

@media (max-width: 760px) {
  .pacing-calculator {
    padding: 0 24px 40px;
  }

  .pacing-calculator__grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Register the partial in `app/globals.scss`**

Add this line after `@use "../styles/hybrid-racing";` (the line added when `/what-is-hyrox` was built):

```scss
@use "../styles/pacing-calculator";
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, no SCSS errors.

- [ ] **Step 4: Commit**

```bash
git add styles/_pacing-calculator.scss app/globals.scss
git commit -m "Add styles for the pacing calculator page"
```

---

### Task 7: The page itself

**Files:**
- Create: `app/hyrox-pacing-calculator/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { OchtShield } from "@/components/OchtShield";
import { PacingCalculator } from "@/components/PacingCalculator";

const pageDescription =
  "Free HYROX and TRYKA pacing calculator. Enter your target finish time and get three realistic split-by-split plans — balanced, run-focused, and station-focused. No signup required.";

export const metadata: Metadata = {
  title: "HYROX Pacing Calculator",
  description: pageDescription,
  alternates: { canonical: "/hyrox-pacing-calculator" },
  openGraph: {
    type: "website",
    url: "/hyrox-pacing-calculator",
    title: "HYROX Pacing Calculator - Ocht",
    description: pageDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "HYROX Pacing Calculator - Ocht",
    description: pageDescription,
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "HYROX Pacing Calculator",
  applicationCategory: "SportsApplication",
  operatingSystem: "Web",
  description: pageDescription,
};

export default function PacingCalculatorPage() {
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
        <nav className="landing-header__actions" aria-label="Site">
          <Link href="/what-is-hyrox">What is HYROX?</Link>
          <Link href="/what-is-tryka">What is TRYKA?</Link>
          <Link href="/app?auth=login">Log in</Link>
          <Link className="btn btn--primary btn--sm" href="/app?auth=signup">
            Sign up free
          </Link>
        </nav>
      </header>

      <section className="format-hero">
        <div className="format-hero__text">
          <p className="format-hero__eyebrow">Free pacing tool · no signup required</p>
          <h1>HYROX pacing calculator</h1>
          <p className="format-hero__dek">
            Enter the finish time you&apos;re aiming for and Ocht builds three
            realistic split-by-split plans to get there — balanced,
            run-focused, and station-focused.
          </p>
        </div>
      </section>

      <PacingCalculator />
    </main>
  );
}
```

Note: this page's hero uses `.format-hero__text` alone, without `.format-hero__photo` (no hero photo for this page) — `.format-hero` in `styles/_hybrid-racing.scss` is a CSS grid (`1fr 42%`) intended for two children; with only one child present it will render as a single column filling the row, which is the desired look here (no broken layout, confirm visually in Step 3).

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `http://127.0.0.1:3002/hyrox-pacing-calculator`.

Expected:
- Hero renders with eyebrow/H1/dek, no broken/empty photo column.
- Target time field defaults to `1:15:00`, level defaults to Competitive, format defaults to HYROX (all via component state, not URL params).
- Balanced tab is active by default, showing 8 runs + 8 stations summing to the target finish time shown at the bottom.
- Clicking "Run-focused" and "Station-focused" tabs switches the displayed plan; each still sums to the same target.
- Changing target time, level, or format updates all three scenarios.
- CTA band at the bottom: while logged out (default), shows "Sign up free" button linking to `/app?auth=signup`. Log in via another tab/session and reload — CTA should switch to "Log my splits" linking to `/app`.
- Check both light and dark theme.

Stop the dev server after checking.

- [ ] **Step 4: Commit**

```bash
git add app/hyrox-pacing-calculator/
git commit -m "Add /hyrox-pacing-calculator page"
```

---

### Task 8: Add to sitemap

**Files:**
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Add the new route**

In `app/sitemap.ts`, update the `staticRoutes` array (currently ending with `/what-is-tryka`) to add the new route:

```ts
const staticRoutes = [
  "",
  "/calculations",
  "/contact",
  "/privacy",
  "/refunds",
  "/terms",
  "/what-is-hyrox",
  "/what-is-tryka",
  "/hyrox-pacing-calculator",
];
```

Update the `formatGuideRoutes` set — leave it unchanged (the pacing calculator is a tool page, not a format guide, so it should get the default priority, not the 0.6 format-guide priority). No other change needed to the file; `formatGuideRoutes` only affects `/what-is-hyrox` and `/what-is-tryka`, and `/hyrox-pacing-calculator` will fall through to the `else` branch (`priority: 0.5`) same as `/calculations` etc. — this is correct as-is since it's not in that set.

- [ ] **Step 2: Verify**

Run: `npm run dev`, then:
```bash
curl -s http://127.0.0.1:3002/sitemap.xml | grep -o '<loc>[^<]*</loc>'
```
Expected: 9 URLs listed, including `https://ocht.app/hyrox-pacing-calculator` (or the `NEXT_PUBLIC_APP_URL` value if set locally). Stop the dev server after checking.

- [ ] **Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "Add pacing calculator to sitemap"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `lib/pacingPredictor.test.ts` (6 tests) and `lib/pacingCta.test.ts` (3 tests).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds, `/hyrox-pacing-calculator` appears in the route output as a static page.

- [ ] **Step 3: Manual browser pass**

Run: `npm run dev`, then in a browser:
1. Visit `/hyrox-pacing-calculator` logged out — confirm the full flow (change target/level/format, switch scenario tabs, confirm each scenario's total matches the entered target) and the "Sign up free" CTA.
2. Log in, revisit the page — confirm the CTA switches to "Log my splits" → `/app`.
3. Confirm the page renders correctly in both light and dark theme.
4. Confirm `/what-is-hyrox` and `/what-is-tryka` still render correctly (their `landing-header__actions` nav was not touched by this plan, but re-verify nothing else broke).

Stop the dev server when done.

- [ ] **Step 4: Confirm no leftover temp files**

Run: `git status`
Expected: clean working tree.

---

## Summary of new/changed files

**New:**
- `lib/pacingPredictor.ts`, `lib/pacingPredictor.test.ts`
- `lib/pacingCta.ts`, `lib/pacingCta.test.ts`
- `components/PacingCalculator.tsx`
- `styles/_pacing-calculator.scss`
- `app/hyrox-pacing-calculator/page.tsx`

**Modified:**
- `lib/raceFormats.ts` (new `runPaceSecPerKm` constant, `Level` import)
- `app/globals.scss` (new `@use`)
- `app/sitemap.ts`
