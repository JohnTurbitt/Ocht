# Live Race/Training Split Logger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a live, tap-to-lap split logger inside the signed-in app shell — a "Log live" entry point beside `SplitForm`'s existing preset actions that lets an athlete log each run/station in real time during a race or training session, then hands off into the exact same report-generation pipeline (`buildAnalysis`, `ReportGenerationOverlay`, `ResultsReveal`, saved history) already used by manual entry.

**Architecture:** Two new pure `lib/` modules (`liveSession.ts` for segment sequencing/tap math/draft persistence, `wakeLock.ts` for the feature-detected Screen Wake Lock wrapper) back three new presentational components (`StationProgressOctagon`, `LiveSessionSetup`, `LiveSessionTracker`). The trickiest part isn't new code — it's that `app/app/page.tsx`'s existing `handleSubmit` tightly couples report-generation/save/reveal logic to a large amount of page-level state. This plan extracts that logic into a reusable `generateAndSaveReport` function *before* wiring in the live session, so both the manual form and the live logger call the same, already-working code path — no new save/reveal logic is written.

**Tech Stack:** Next.js 15 App Router, TypeScript, React state (no new global state library), Vitest for `lib/` tests, the browser's Screen Wake Lock API (feature-detected).

**Full spec:** `docs/superpowers/specs/2026-08-17-live-race-logger-design.md`

---

### Task 1: `lib/liveSession.ts` — segment sequencing, tap math, draft persistence

**Files:**
- Create: `lib/liveSession.ts`
- Create: `lib/liveSession.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/liveSession.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSegmentSequence,
  clearDraft,
  draftToReportInputs,
  isSessionComplete,
  loadDraft,
  recordLap,
  saveDraft,
  startDraft,
  undoLastLap,
} from "./liveSession";

function makeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: makeStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildSegmentSequence", () => {
  it("returns 16 segments for hyrox in run/station order, matching real station data", () => {
    const sequence = buildSegmentSequence("hyrox");
    expect(sequence).toHaveLength(16);
    expect(sequence.map((s) => s.type)).toEqual([
      "run", "station", "run", "station", "run", "station", "run", "station",
      "run", "station", "run", "station", "run", "station", "run", "station",
    ]);
    expect(sequence[0]).toEqual({ type: "run", key: "run-1", label: "Run 1" });
    expect(sequence[1].type).toBe("station");
    expect(sequence[1].label).toBe("SkiErg");
  });

  it("returns 16 segments for tryka800 with TRYKA-relabeled stations", () => {
    const sequence = buildSegmentSequence("tryka800");
    expect(sequence).toHaveLength(16);
    expect(sequence[1].label).toBe("SkiErg 1,000m");
  });
});

describe("recordLap / undoLastLap / isSessionComplete", () => {
  it("appends segments in sequence order as laps are recorded", () => {
    let draft = startDraft("hyrox", "competitive", "1:15:00");
    draft = recordLap(draft, 280);
    draft = recordLap(draft, 250);

    expect(draft.segments).toEqual([
      { type: "run", key: "run-1", seconds: 280 },
      { type: "station", key: "ski", seconds: 250 },
    ]);
  });

  it("ignores taps once the session is already complete", () => {
    let draft = startDraft("hyrox", "competitive", "");
    for (let i = 0; i < 16; i++) {
      draft = recordLap(draft, 200);
    }
    expect(isSessionComplete(draft)).toBe(true);

    const overTapped = recordLap(draft, 999);
    expect(overTapped.segments).toHaveLength(16);
    expect(overTapped).toEqual(draft);
  });

  it("undo removes exactly the most recently recorded lap", () => {
    let draft = startDraft("hyrox", "competitive", "");
    draft = recordLap(draft, 280);
    draft = recordLap(draft, 250);
    draft = undoLastLap(draft);

    expect(draft.segments).toEqual([{ type: "run", key: "run-1", seconds: 280 }]);
  });

  it("undo on an empty draft is a safe no-op", () => {
    const draft = startDraft("hyrox", "competitive", "");
    expect(undoLastLap(draft).segments).toEqual([]);
  });

  it("isSessionComplete is false until all 16 segments are recorded", () => {
    let draft = startDraft("hyrox", "competitive", "");
    for (let i = 0; i < 15; i++) {
      draft = recordLap(draft, 200);
    }
    expect(isSessionComplete(draft)).toBe(false);
    draft = recordLap(draft, 200);
    expect(isSessionComplete(draft)).toBe(true);
  });
});

describe("draftToReportInputs", () => {
  it("maps a complete draft to the exact runs[]/stationSplits shape buildAnalysis expects", () => {
    let draft = startDraft("hyrox", "competitive", "1:15:00");
    const lapTimes = [280, 250, 285, 300, 290, 240, 288, 350, 292, 190, 289, 210, 291, 335, 293, 410];
    for (const seconds of lapTimes) {
      draft = recordLap(draft, seconds);
    }

    const { runs, stationSplits } = draftToReportInputs(draft);

    expect(runs).toHaveLength(8);
    expect(runs[0]).toBe("4:40");
    expect(stationSplits.ski).toBe("4:10");
    expect(stationSplits.wallBalls).toBe("6:50");
  });
});

describe("draft persistence", () => {
  it("round-trips a draft through localStorage", () => {
    let draft = startDraft("hyrox", "competitive", "1:15:00");
    draft = recordLap(draft, 280);
    saveDraft(draft);

    const loaded = loadDraft();
    expect(loaded).toEqual(draft);
  });

  it("returns null when no draft has been saved", () => {
    expect(loadDraft()).toBeNull();
  });

  it("clearDraft removes the saved draft", () => {
    const draft = startDraft("hyrox", "competitive", "");
    saveDraft(draft);
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/liveSession.test.ts`
Expected: FAIL with "Cannot find module './liveSession'".

- [ ] **Step 3: Write the implementation**

Create `lib/liveSession.ts`:

```ts
import { Level, StationKey, formatTime } from "./analysis";
import { RaceFormat, getRaceFormatOption } from "./raceFormats";

// The live logger only supports fixed formats with a real, known station
// sequence — "custom" races have no fixed sequence a tap-to-lap flow could
// follow, so it's excluded at the type level (same pattern already used by
// PacingCalculator's format picker and lib/pacingPredictor.ts's runtime guard).
export type LiveSessionFormat = Exclude<RaceFormat, "custom">;

export type LiveSessionSegment = {
  type: "run" | "station";
  key: string;
  seconds: number;
};

export type LiveSessionDraft = {
  raceFormat: LiveSessionFormat;
  level: Level;
  targetTime: string;
  startedAt: string;
  segments: LiveSessionSegment[];
};

export type SegmentDescriptor = {
  type: "run" | "station";
  key: string;
  label: string;
};

const RUN_LEG_COUNT = 8;
const DRAFT_STORAGE_KEY = "ocht.liveSession.draft";

export function buildSegmentSequence(
  raceFormat: LiveSessionFormat,
): SegmentDescriptor[] {
  const format = getRaceFormatOption(raceFormat);
  const sequence: SegmentDescriptor[] = [];

  for (let i = 0; i < RUN_LEG_COUNT; i++) {
    sequence.push({ type: "run", key: `run-${i + 1}`, label: `Run ${i + 1}` });

    const station = format.stations[i];
    if (station) {
      sequence.push({ type: "station", key: station.key, label: station.label });
    }
  }

  return sequence;
}

export function startDraft(
  raceFormat: LiveSessionFormat,
  level: Level,
  targetTime: string,
): LiveSessionDraft {
  return {
    raceFormat,
    level,
    targetTime,
    startedAt: new Date().toISOString(),
    segments: [],
  };
}

export function recordLap(draft: LiveSessionDraft, seconds: number): LiveSessionDraft {
  const sequence = buildSegmentSequence(draft.raceFormat);
  const next = sequence[draft.segments.length];

  if (!next) {
    return draft;
  }

  return {
    ...draft,
    segments: [...draft.segments, { type: next.type, key: next.key, seconds }],
  };
}

export function undoLastLap(draft: LiveSessionDraft): LiveSessionDraft {
  return { ...draft, segments: draft.segments.slice(0, -1) };
}

export function isSessionComplete(draft: LiveSessionDraft): boolean {
  return draft.segments.length >= buildSegmentSequence(draft.raceFormat).length;
}

export function draftToReportInputs(draft: LiveSessionDraft): {
  runs: string[];
  stationSplits: Record<StationKey, string>;
} {
  const runs: string[] = [];
  const stationSplits: Record<StationKey, string> = {};

  for (const segment of draft.segments) {
    if (segment.type === "run") {
      runs.push(formatTime(segment.seconds));
    } else {
      stationSplits[segment.key] = formatTime(segment.seconds);
    }
  }

  return { runs, stationSplits };
}

export function saveDraft(draft: LiveSessionDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function loadDraft(): LiveSessionDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as LiveSessionDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/liveSession.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/liveSession.ts lib/liveSession.test.ts
git commit -m "Add live session segment sequencing and draft persistence"
```

---

### Task 2: `lib/wakeLock.ts` — feature-detected Screen Wake Lock wrapper

**Files:**
- Create: `lib/wakeLock.ts`
- Create: `lib/wakeLock.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/wakeLock.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { releaseWakeLock, requestWakeLock } from "./wakeLock";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestWakeLock", () => {
  it("returns null when navigator.wakeLock is unsupported, without throwing", async () => {
    vi.stubGlobal("navigator", {});
    const result = await requestWakeLock();
    expect(result).toBeNull();
  });

  it("requests and returns a wake lock sentinel when supported", async () => {
    const fakeSentinel = { release: vi.fn().mockResolvedValue(undefined) };
    const request = vi.fn().mockResolvedValue(fakeSentinel);
    vi.stubGlobal("navigator", { wakeLock: { request } });

    const result = await requestWakeLock();

    expect(request).toHaveBeenCalledWith("screen");
    expect(result).toBe(fakeSentinel);
  });

  it("returns null if the request itself throws (e.g. permission denied)", async () => {
    const request = vi.fn().mockRejectedValue(new Error("not allowed"));
    vi.stubGlobal("navigator", { wakeLock: { request } });

    const result = await requestWakeLock();
    expect(result).toBeNull();
  });
});

describe("releaseWakeLock", () => {
  it("releases a real sentinel", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    await releaseWakeLock({ release } as unknown as WakeLockSentinel);
    expect(release).toHaveBeenCalled();
  });

  it("is a safe no-op when given null", async () => {
    await expect(releaseWakeLock(null)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/wakeLock.test.ts`
Expected: FAIL with "Cannot find module './wakeLock'".

- [ ] **Step 3: Write the implementation**

Create `lib/wakeLock.ts`:

```ts
// Thin, feature-detected wrapper around the Screen Wake Lock API. Not
// universally supported (works on modern Chrome/Android and Safari iOS
// 16.4+) — every function here degrades to a safe no-op instead of throwing
// when the API is unavailable, since the live session must keep working on
// browsers without it.

export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
    return null;
  }

  try {
    return await (navigator as Navigator).wakeLock.request("screen");
  } catch {
    return null;
  }
}

export async function releaseWakeLock(
  sentinel: WakeLockSentinel | null,
): Promise<void> {
  if (!sentinel) {
    return;
  }

  try {
    await sentinel.release();
  } catch {
    // Already released or unsupported — nothing more to do.
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/wakeLock.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors. (`WakeLockSentinel` is a standard DOM lib type already available via TypeScript's `lib.dom.d.ts` — no extra type package needed.)

- [ ] **Step 6: Commit**

```bash
git add lib/wakeLock.ts lib/wakeLock.test.ts
git commit -m "Add feature-detected Screen Wake Lock wrapper"
```

---

### Task 3: `StationProgressOctagon` component

**Files:**
- Create: `components/StationProgressOctagon.tsx`

This is the live completion-tracker octagon approved in brainstorming — 8 sides = 8 stations, the Ocht shield centered, three states per side (grey/pulsing-glow/solid). It is **distinct from** the `StationOctagon` component planned in `docs/superpowers/specs/2026-08-14-report-training-visuals-design.md` (that one is a post-race benchmark-gap radar with different data — do not confuse the two or try to merge them).

- [ ] **Step 1: Write the component**

Create `components/StationProgressOctagon.tsx`:

```tsx
type StationProgressOctagonProps = {
  doneCount: number; // 0-8 stations completed
  inProgress: boolean; // is a station currently underway (the (doneCount+1)th side pulses)
  size?: number;
};

const STATION_COUNT = 8;

function polarPoint(cx: number, cy: number, r: number, index: number, count: number) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2 - Math.PI / count;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
}

export function StationProgressOctagon({
  doneCount,
  inProgress,
  size = 60,
}: StationProgressOctagonProps) {
  const cx = 50;
  const cy = 50;
  const r = 38;
  const points = Array.from({ length: STATION_COUNT }, (_, i) =>
    polarPoint(cx, cy, r, i, STATION_COUNT),
  );
  const fillPoints = points.map(([x, y]) => `${x},${y}`).join(" ");
  const glowId = "station-octagon-glow";

  const shieldW = 30;
  const shieldH = (shieldW * 78) / 64;
  const allDone = doneCount >= STATION_COUNT;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${Math.min(doneCount, STATION_COUNT)} of ${STATION_COUNT} stations complete`}
    >
      <defs>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon points={fillPoints} fill="#0f1913" stroke="none" />
      <polygon points={fillPoints} fill="none" stroke="#20302a" strokeWidth={2.5} />

      {points.map(([x1, y1], i) => {
        const [x2, y2] = points[(i + 1) % STATION_COUNT];
        const done = allDone || i < doneCount;
        const current = !allDone && i === doneCount && inProgress;

        if (!done && !current) {
          return null;
        }

        return (
          <line
            key={`side-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#c8ff2e"
            strokeWidth={4.5}
            strokeLinecap="round"
            filter={current ? `url(#${glowId})` : undefined}
            className={current ? "station-octagon__pulse" : undefined}
          />
        );
      })}

      {points.map(([x, y], i) => {
        const lit =
          allDone ||
          i < doneCount ||
          (i === doneCount && inProgress) ||
          ((i - 1 + STATION_COUNT) % STATION_COUNT === doneCount && inProgress);

        return (
          <circle
            key={`dot-${i}`}
            cx={x}
            cy={y}
            r={2.2}
            fill={lit ? "#c8ff2e" : "#20302a"}
          />
        );
      })}

      <g transform={`translate(${cx - shieldW / 2}, ${cy - shieldH / 2})`}>
        <path
          d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
          transform={`scale(${shieldW / 64})`}
          fill="rgba(200,255,46,0.06)"
          stroke="#4a5c52"
          strokeWidth={2}
        />
        <text
          x={shieldW / 2}
          y={shieldH * 0.74}
          textAnchor="middle"
          fontFamily="var(--font-display), sans-serif"
          fontWeight={900}
          fontSize={shieldH * 0.62}
          fill="#c8ff2e"
        >
          8
        </text>
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Add the pulse animation**

Create the styles this component needs by adding to `styles/_report.scss` (append at the end of the file — this partial already handles other report-related presentational styles):

```scss
@keyframes station-octagon-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.station-octagon__pulse {
  animation: station-octagon-pulse 1.2s ease-in-out infinite;
}
```

- [ ] **Step 3: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors. (Not mounted anywhere yet — this only catches syntax/type mistakes.)

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, no SCSS errors.

- [ ] **Step 5: Commit**

```bash
git add components/StationProgressOctagon.tsx styles/_report.scss
git commit -m "Add StationProgressOctagon component"
```

---

### Task 4: `LiveSessionSetup` component

**Files:**
- Create: `components/LiveSessionSetup.tsx`

- [ ] **Step 1: Write the component**

Create `components/LiveSessionSetup.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Level, levelLabels } from "@/lib/analysis";
import { LiveSessionFormat } from "@/lib/liveSession";
import { raceFormatOptions } from "@/lib/raceFormats";
import { maskTimeInput, normalizeTimeInput } from "@/lib/validation";

type LiveSessionSetupProps = {
  onStart: (input: { raceFormat: LiveSessionFormat; level: Level; targetTime: string }) => void;
  onCancel: () => void;
};

export function LiveSessionSetup({ onStart, onCancel }: LiveSessionSetupProps) {
  const [raceFormat, setRaceFormat] = useState<LiveSessionFormat>("hyrox");
  const [level, setLevel] = useState<Level>("competitive");
  const [targetTime, setTargetTime] = useState("");

  return (
    <div className="live-session-setup">
      <p className="eyebrow">Live session</p>
      <h2>Start a race or training set</h2>
      <p className="live-session-setup__guide">
        Lap your watch — or just tap the button on the next screen — after
        every run and every station, 16 taps total. Ready when you are.
      </p>

      <div className="input-row">
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

        <label className="field">
          <span>Target time (optional)</span>
          <input
            value={targetTime}
            onChange={(event) => setTargetTime(maskTimeInput(event.target.value, "race"))}
            onBlur={(event) => setTargetTime(normalizeTimeInput(event.target.value, "race"))}
            inputMode="numeric"
            placeholder="1:15:00"
          />
        </label>
      </div>

      <div className="scroll-fade-wrap format-picker-wrap">
        <div className="format-picker" aria-label="Race format">
          {raceFormatOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={option.id === raceFormat ? "format-card is-active" : "format-card"}
              onClick={() => setRaceFormat(option.id as LiveSessionFormat)}
            >
              <span className="format-card__name">{option.label}</span>
              <span className="format-card__sub">
                {option.runLabel} · {option.stations.length} rounds
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="live-session-setup__actions">
        <button type="button" onClick={onCancel} className="btn btn--secondary">
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={() => onStart({ raceFormat, level, targetTime })}
        >
          Start session
        </button>
      </div>
    </div>
  );
}
```

Note: `raceFormatOptions` (from `lib/raceFormats.ts`) only ever contains `hyrox`/`tryka800`/`tryka500` — it never includes `"custom"` — so the `option.id as LiveSessionFormat` cast is safe (confirmed by reading `raceFormatOptions`'s definition; the same fact `PacingCalculator.tsx` already relies on for its own format picker).

- [ ] **Step 2: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/LiveSessionSetup.tsx
git commit -m "Add LiveSessionSetup component"
```

---

### Task 5: `LiveSessionTracker` component

**Files:**
- Create: `components/LiveSessionTracker.tsx`

This is the live-tap screen: octagon + segment label, live-ticking tap button, undo, scrolling split list, wake lock while active, autosave to the draft on every lap/undo, a brief "all done" beat, then an optional official-finish-time prompt (for roxzone tax — see the spec's "Roxzone" section) before calling `onFinish`.

- [ ] **Step 1: Write the component**

Create `components/LiveSessionTracker.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { StationProgressOctagon } from "./StationProgressOctagon";
import { Level } from "@/lib/analysis";
import {
  LiveSessionDraft,
  LiveSessionFormat,
  buildSegmentSequence,
  clearDraft,
  draftToReportInputs,
  isSessionComplete,
  recordLap,
  saveDraft,
  startDraft,
  undoLastLap,
} from "@/lib/liveSession";
import { StationKey } from "@/lib/analysis";
import { maskTimeInput, normalizeTimeInput } from "@/lib/validation";
import { releaseWakeLock, requestWakeLock } from "@/lib/wakeLock";

type LiveSessionTrackerProps = {
  raceFormat: LiveSessionFormat;
  level: Level;
  targetTime: string;
  initialDraft?: LiveSessionDraft;
  onFinish: (input: {
    runs: string[];
    stationSplits: Record<StationKey, string>;
    officialFinishTime: string;
  }) => void;
};

function formatSegmentTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function LiveSessionTracker({
  raceFormat,
  level,
  targetTime,
  initialDraft,
  onFinish,
}: LiveSessionTrackerProps) {
  const [draft, setDraft] = useState<LiveSessionDraft>(
    () => initialDraft ?? startDraft(raceFormat, level, targetTime),
  );
  const [elapsedOnCurrent, setElapsedOnCurrent] = useState(0);
  const [stage, setStage] = useState<"tapping" | "beat" | "finishTime">("tapping");
  const [officialFinishTime, setOfficialFinishTime] = useState("");
  const justFinished = stage !== "tapping";
  const segmentStartRef = useRef<number>(Date.now());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const sequence = buildSegmentSequence(raceFormat);
  const currentIndex = draft.segments.length;
  const currentSegment = sequence[currentIndex];
  const doneStationCount = draft.segments.filter((s) => s.type === "station").length;
  const currentIsStation = currentSegment?.type === "station";

  useEffect(() => {
    let active = true;

    requestWakeLock().then((sentinel) => {
      if (active) {
        wakeLockRef.current = sentinel;
      } else {
        releaseWakeLock(sentinel);
      }
    });

    return () => {
      active = false;
      releaseWakeLock(wakeLockRef.current);
      wakeLockRef.current = null;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedOnCurrent(Math.round((Date.now() - segmentStartRef.current) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentIndex]);

  function handleTap() {
    if (!currentSegment) {
      return;
    }

    const seconds = (Date.now() - segmentStartRef.current) / 1000;
    const nextDraft = recordLap(draft, seconds);
    setDraft(nextDraft);
    saveDraft(nextDraft);
    segmentStartRef.current = Date.now();
    setElapsedOnCurrent(0);

    if (isSessionComplete(nextDraft)) {
      setStage("beat");
      window.setTimeout(() => {
        setStage("finishTime");
      }, 700);
    }
  }

  function handleFinishTimeSubmit() {
    clearDraft();
    onFinish({ ...draftToReportInputs(draft), officialFinishTime });
  }

  function handleUndo() {
    if (draft.segments.length === 0) {
      return;
    }

    const nextDraft = undoLastLap(draft);
    setDraft(nextDraft);
    saveDraft(nextDraft);
    segmentStartRef.current = Date.now();
    setElapsedOnCurrent(0);
  }

  return (
    <div className="live-session-tracker">
      <div className="live-session-tracker__header">
        <StationProgressOctagon
          doneCount={justFinished ? 8 : doneStationCount}
          inProgress={!justFinished && currentIsStation}
        />
        <div>
          <p className="live-session-tracker__status">
            {justFinished
              ? "FINISHED"
              : `STATION ${Math.min(doneStationCount + (currentIsStation ? 1 : 0), 8)} OF 8 · SEGMENT ${currentIndex + 1}/16`}
          </p>
          <h1>{justFinished ? "Nice work." : (currentSegment?.label ?? "")}</h1>
        </div>
      </div>

      {stage === "finishTime" ? (
        <div className="live-session-tracker__finish-time">
          <label className="field">
            <span>Official finish time (optional)</span>
            <input
              value={officialFinishTime}
              onChange={(event) =>
                setOfficialFinishTime(maskTimeInput(event.target.value, "race"))
              }
              onBlur={(event) =>
                setOfficialFinishTime(normalizeTimeInput(event.target.value, "race"))
              }
              inputMode="numeric"
              placeholder="From the results board or your chip"
            />
          </label>
          <p className="live-session-tracker__finish-time-hint">
            Enter this to see your roxzone tax in the report — or leave it
            blank and continue without one.
          </p>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={handleFinishTimeSubmit}
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="live-session-tracker__tap"
            onClick={handleTap}
            disabled={justFinished || !currentSegment}
          >
            <span className="live-session-tracker__timer">{formatSegmentTime(elapsedOnCurrent)}</span>
            <span className="live-session-tracker__tap-label">TAP TO LAP</span>
          </button>

          <button
            type="button"
            className="live-session-tracker__undo"
            onClick={handleUndo}
            disabled={draft.segments.length === 0 || justFinished}
          >
            Undo last lap
          </button>
        </>
      )}

      <div className="live-session-tracker__splits">
        <p className="live-session-tracker__splits-heading">Splits so far</p>
        {draft.segments.map((segment, index) => (
          <div className="live-session-tracker__split-row" key={`${segment.key}-${index}`}>
            <span>{sequence[index]?.label ?? segment.key}</span>
            <span>{formatSegmentTime(segment.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add minimal styling**

Create `styles/_live-session.scss`:

```scss
// Styles for the live tap-to-lap session (setup + tracker screens). Reuses
// .field/.input-row/.format-picker/.format-card from _forms.scss and
// .btn/.btn--primary/.btn--secondary from _buttons.scss for shared controls
// — this partial only covers what's unique to these two screens.

.live-session-setup {
  max-width: 44rem;
  margin: 0 auto;
  padding: 32px;
}

.live-session-setup__guide {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 8px 0 24px;
}

.live-session-setup__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.live-session-tracker {
  max-width: 30rem;
  margin: 0 auto;
  padding: 24px;
}

.live-session-tracker__header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.live-session-tracker__header h1 {
  font-family: var(--font-display);
  font-size: 1.25rem;
  margin: 2px 0 0;
  color: var(--ink);
}

.live-session-tracker__status {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--muted);
  margin: 0;
}

.live-session-tracker__tap {
  width: 100%;
  min-height: 112px;
  border-radius: 16px;
  background: var(--lime);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 0 0 12px;
  border: none;
  cursor: pointer;
}

.live-session-tracker__tap:disabled {
  opacity: 0.6;
  cursor: default;
}

.live-session-tracker__timer {
  font-family: var(--font-mono);
  color: #08100d;
  font-weight: 800;
  font-size: 1.9rem;
  line-height: 1;
}

.live-session-tracker__tap-label {
  color: #08100d;
  opacity: 0.6;
  font-weight: 700;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
}

.live-session-tracker__undo {
  width: auto;
  min-height: 0;
  margin: 0 0 20px;
  padding: 8px 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  cursor: pointer;
}

.live-session-tracker__undo:disabled {
  opacity: 0.4;
  cursor: default;
}

.live-session-tracker__splits-heading {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 8px;
}

.live-session-tracker__split-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  font-size: 0.85rem;
  color: var(--ink);
}

.live-session-tracker__finish-time {
  margin-bottom: 20px;
}

.live-session-tracker__finish-time-hint {
  color: var(--muted);
  font-size: 0.8rem;
  margin: 8px 0 16px;
}
```

Register it in `app/globals.scss` (add after the last existing `@use` line):

```scss
@use "../styles/live-session";
```

- [ ] **Step 3: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds, no SCSS errors. (Not mounted anywhere yet, so this only proves everything compiles.)

- [ ] **Step 5: Commit**

```bash
git add components/LiveSessionTracker.tsx styles/_live-session.scss app/globals.scss
git commit -m "Add LiveSessionTracker component"
```

---

### Task 6: Extract `generateAndSaveReport` from `handleSubmit`

**Files:**
- Modify: `app/app/page.tsx`

This is a **behavior-preserving refactor** — no new functionality. `handleSubmit` (currently ~lines 688-831) mixes manual-form validation with the actual report-generation/save/reveal logic. This task pulls the generation/save/reveal part into its own function so Task 7 can call it from the live session too, without duplicating ~100 lines of state-coupled logic. `handleSubmit` keeps its validation step, then delegates.

- [ ] **Step 1: Read the current `handleSubmit` to confirm it matches**

Before editing, read `app/app/page.tsx` around the `handleSubmit` function (currently starts at line 688) and confirm it matches this structure: validates via `validateReportInput`, then (on success) calls `buildAnalysis`, builds a `SavedReport`, saves it (remote via `saveRemoteReport` if `user` is set, otherwise local via `saveReports`), and reveals the result (`setAnalysis`, `setShowResultsReveal`, etc.), ending with `trackEvent("report_generated", ...)` and a `scrollIntoView` call. If the actual current content differs meaningfully from this description (e.g. due to other work landing on this file since this plan was written), stop and ask rather than guessing at how to adapt.

- [ ] **Step 2: Replace `handleSubmit` with the extracted function + a slimmer `handleSubmit`**

Find the full `async function handleSubmit(event: FormEvent<HTMLFormElement>) { ... }` block and replace it with:

```tsx
  async function generateAndSaveReport(input: {
    goal: string;
    targetTime: string;
    level: Level;
    runs: string[];
    stationSplits: Record<StationKey, string>;
    stationDefinitions: Station[];
    raceFormat: RaceFormat;
    officialFinishTime: string;
    trainingContext: TrainingContext;
  }) {
    const {
      goal,
      targetTime,
      level,
      runs,
      stationSplits,
      stationDefinitions,
      raceFormat,
      officialFinishTime,
      trainingContext,
    } = input;

    setGeneratingReport(true);
    // Hold the generation overlay long enough to read as intentional, even
    // though the math is synchronous and any remote save is usually fast.
    const minimumHold = new Promise<void>((resolve) =>
      window.setTimeout(resolve, 1700),
    );

    const generatedAnalysis = buildAnalysis(
      goal,
      targetTime,
      level,
      runs,
      stationSplits,
      stationDefinitions,
      raceFormat,
      officialFinishTime,
    );
    const savedReport: SavedReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      raceFormat,
      goal,
      targetTime,
      officialFinishTime: officialFinishTime || undefined,
      level,
      runs,
      stationDefinitions:
        raceFormat === "custom" ? stationDefinitions : undefined,
      stationSplits,
      trainingContext: hasTrainingContext(trainingContext)
        ? trainingContext
        : undefined,
      finishSeconds: generatedAnalysis.finishSeconds,
      predictedTargetSeconds: generatedAnalysis.predictedTargetSeconds,
      topLeakLabel: generatedAnalysis.topLeaks[0]?.label ?? "",
    };
    let nextReports = [savedReport, ...savedReports].slice(0, 12);

    if (user) {
      try {
        const remoteReport = await saveRemoteReport({
          goal,
          targetTime,
          level,
          raceFormat,
          runs,
          stationDefinitions:
            raceFormat === "custom" ? stationDefinitions : undefined,
          stationSplits,
          trainingContext: hasTrainingContext(trainingContext)
            ? trainingContext
            : undefined,
        });

        nextReports = [remoteReport, ...savedReports];
      } catch (error) {
        await minimumHold;
        setGeneratingReport(false);
        setAnalysis(generatedAnalysis);
        setValidationErrors([]);
        setFieldErrors({});
        setToast({
          id: Date.now(),
          title: "Report generated",
          message:
            error instanceof Error
              ? `${error.message} The report is visible below but was not saved.`
              : "The report is visible below but was not saved to your account.",
          tone: "error",
        });
        window.requestAnimationFrame(() => {
          reportRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
        return;
      }
    } else {
      saveReports(nextReports);
    }

    await minimumHold;
    setGeneratingReport(false);
    setAnalysis(generatedAnalysis);
    setViewingSavedReport(false);
    setRevealIsPb(
      isNewPersonalBest(
        savedReports,
        generatedAnalysis.finishSeconds,
        groupKeyForReport(savedReport),
      ),
    );
    setShowResultsReveal(true);
    if (!beginnerGuideDismissed) {
      dismissBeginnerGuide("beginner_guide_completed_by_report");
    }
    setValidationErrors([]);
    setFieldErrors({});
    setSavedReports(nextReports);
    setActiveTab("new");
    if (!hasGeneratedReportEver) {
      window.localStorage.setItem(hasGeneratedReportKey, "true");
      setHasGeneratedReportEver(true);
    }
    trackEvent("report_generated", {
      race_format: raceFormat,
      signed_in: Boolean(user),
      premium: fullReportUnlocked,
      saved_remote: Boolean(user),
      run_count: runs.length,
      station_count: stationDefinitions.length,
    });
    window.requestAnimationFrame(() => {
      reportRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateReportInput({
      targetTime,
      runs,
      stationSplits,
      stationDefinitions: activeStationDefinitions,
    });

    if (!validation.valid) {
      setValidationErrors(validation.errors);
      setFieldErrors(validation.fieldErrors);
      setToast({
        id: Date.now(),
        title: "Report not generated",
        message:
          validation.errors.length === 1
            ? validation.errors[0]
            : `${validation.errors.length} fields need valid times before Ocht can calculate the report.`,
        tone: "error",
      });
      return;
    }

    await generateAndSaveReport({
      goal,
      targetTime,
      level,
      runs,
      stationSplits,
      stationDefinitions: activeStationDefinitions,
      raceFormat,
      officialFinishTime,
      trainingContext,
    });
  }
```

- [ ] **Step 3: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors. If `Station`, `StationKey`, `TrainingContext`, `Level`, or `RaceFormat` are not already imported as types in this file, add them to the existing import statements from `@/lib/analysis`, `@/lib/raceFormats`, and `@/lib/trainingContext` respectively — but check first, since this file already imports and uses all of these types extensively for its existing state (`runs`, `stationSplits`, `level`, `raceFormat`, `trainingContext` are all already typed with them).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass — this is a pure refactor, so nothing about test behavior should change.

- [ ] **Step 5: Manually verify manual report generation still works**

Run: `npm run dev`, open `/app`, fill in the sample race (the existing "Load sample race" button), submit, confirm the report generates and reveals exactly as before (this exercises the new `generateAndSaveReport` function via `handleSubmit`, proving the extraction preserved behavior). Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add app/app/page.tsx
git commit -m "Extract generateAndSaveReport from handleSubmit for reuse by the live session"
```

---

### Task 7: Wire the live session into the app shell

**Files:**
- Modify: `components/SplitForm.tsx`
- Modify: `app/app/page.tsx`

- [ ] **Step 1: Add a "Log live" button to `SplitForm`'s preset actions**

In `components/SplitForm.tsx`, add a new prop to `SplitFormProps` (find the existing prop list, e.g. near `onLoadSample: () => void;`) by adding:

```tsx
  onStartLiveSession: () => void;
```

Destructure it in the component's parameter list alongside the other `on*` props (e.g. next to `onLoadSample`):

```tsx
  onStartLiveSession,
```

Find the preset-actions block (the `<div className="preset-actions" ...>` containing "Load sample race" / "Reset defaults" / "Clear form" / "How it works" buttons) and add a new button after "Clear form" and before the "How it works" button:

```tsx
            <button
              type="button"
              onClick={(e) => {
                onStartLiveSession();
                e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
              }}
            >
              Log live
            </button>
```

- [ ] **Step 2: Add live-session state and mounting in `app/app/page.tsx`**

Add these imports near the top of the file, alongside the existing component/lib imports:

```tsx
import { LiveSessionSetup } from "@/components/LiveSessionSetup";
import { LiveSessionTracker } from "@/components/LiveSessionTracker";
import {
  LiveSessionDraft,
  LiveSessionFormat,
  clearDraft,
  loadDraft,
} from "@/lib/liveSession";
```

Add new state near the other `useState` declarations (e.g. near `generatingReport`/`showResultsReveal`):

```tsx
  const [liveSessionStage, setLiveSessionStage] = useState<"idle" | "setup" | "tracking">("idle");
  const [liveSessionConfig, setLiveSessionConfig] = useState<{
    raceFormat: LiveSessionFormat;
    level: Level;
    targetTime: string;
  } | null>(null);
```

Add a handler function near the other handlers (e.g. above `handleSubmit`) that checks for an interrupted draft before deciding which screen to show — this is what fulfils the spec's "on load, if a draft session exists, offer to resume it rather than silently discarding it":

```tsx
  function startLiveSession() {
    const existingDraft = loadDraft();

    if (existingDraft) {
      const resume = window.confirm(
        "You have an unfinished live session in progress. Resume it? (Cancel starts a new session and discards it.)",
      );

      if (resume) {
        setLiveSessionConfig({
          raceFormat: existingDraft.raceFormat,
          level: existingDraft.level,
          targetTime: existingDraft.targetTime,
        });
        setLiveSessionDraftToResume(existingDraft);
        setLiveSessionStage("tracking");
        return;
      }

      clearDraft();
    }

    setLiveSessionStage("setup");
  }
```

Add the matching import and one more piece of state alongside `liveSessionStage`/`liveSessionConfig`:

```tsx
  const [liveSessionDraftToResume, setLiveSessionDraftToResume] =
    useState<LiveSessionDraft | null>(null);
```

(Add `clearDraft` and `LiveSessionDraft` to the existing `@/lib/liveSession` import alongside `LiveSessionFormat`/`loadDraft`.)

Pass `startLiveSession` (not an inline arrow) to `<SplitForm ... />` (find the existing JSX invocation and add):

```tsx
            onStartLiveSession={startLiveSession}
```

- [ ] **Step 3: Render the live session screens**

Find where `<SplitForm ...>` is rendered inside the JSX tree. Wrap it so the live session screens take over that same slot when active — change:

```tsx
            <SplitForm
              ...
              onStartLiveSession={() => setLiveSessionStage("setup")}
              ...
            />
```

to:

```tsx
            {liveSessionStage === "setup" ? (
              <LiveSessionSetup
                onCancel={() => setLiveSessionStage("idle")}
                onStart={(config) => {
                  setLiveSessionConfig(config);
                  setLiveSessionStage("tracking");
                }}
              />
            ) : liveSessionStage === "tracking" && liveSessionConfig ? (
              <LiveSessionTracker
                raceFormat={liveSessionConfig.raceFormat}
                level={liveSessionConfig.level}
                targetTime={liveSessionConfig.targetTime}
                initialDraft={liveSessionDraftToResume ?? undefined}
                onFinish={({
                  runs: liveRuns,
                  stationSplits: liveStationSplits,
                  officialFinishTime: liveOfficialFinishTime,
                }) => {
                  setLiveSessionStage("idle");
                  setLiveSessionConfig(null);
                  setLiveSessionDraftToResume(null);
                  void generateAndSaveReport({
                    goal: "",
                    targetTime: liveSessionConfig.targetTime,
                    level: liveSessionConfig.level,
                    runs: liveRuns,
                    stationSplits: liveStationSplits,
                    stationDefinitions: getRaceFormatStations(liveSessionConfig.raceFormat),
                    raceFormat: liveSessionConfig.raceFormat,
                    officialFinishTime: liveOfficialFinishTime,
                    trainingContext: emptyTrainingContext,
                  });
                }}
              />
            ) : (
              <SplitForm
                ...
                onStartLiveSession={() => setLiveSessionStage("setup")}
                ...
              />
            )}
```

(Keep every existing prop on `<SplitForm>` exactly as it is today — only the new `onStartLiveSession` prop and the surrounding conditional wrapper are new. `getRaceFormatStations` is already imported in this file per its use in `loadReport`; `emptyTrainingContext` is already imported per its existing use at the file's other `setTrainingContext(emptyTrainingContext)` call sites.)

- [ ] **Step 4: Verify types check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev`, open `/app` while signed in (or signed out — this should work both ways, matching existing manual-entry behavior).

Expected:
- The "Log live" button appears in the preset actions row alongside "Load sample race" / "Reset defaults" / "Clear form" / "How it works".
- Clicking it shows the setup screen (format/level/target picker).
- "Start session" moves to the live-tap screen: octagon top-left, current segment label, tap button with a live-ticking timer, undo button, empty split list.
- Tapping the button 16 times in sequence (HYROX) advances through all runs/stations, each appearing in the split list; the octagon fills a side for each completed station and pulses on the current one.
- After the 16th tap, a brief "FINISHED" beat plays (all 8 octagon sides lit), then an optional "Official finish time" prompt appears. Entering a time longer than the sum of the logged splits and clicking "Continue" should produce a report showing a nonzero roxzone tax; leaving it blank and continuing should produce a report with no roxzone tax, identical to today's manual-entry behavior with no official finish time.
- After the finish-time prompt, the screen transitions into the normal `ReportGenerationOverlay` → `ResultsReveal` → report flow — the same as a manually-submitted report.
- The resulting report appears in "History" like any other saved report.
- Clicking "Undo last lap" during a session correctly removes the most recent tap and lets you re-tap it.
- Start a new live session, tap a few laps, then reload the page (simulating an interrupted session) *without* finishing. Click "Log live" again — a confirm dialog should appear offering to resume; confirming should drop you straight into the live-tap screen with the earlier taps already present in the split list (skipping the setup screen). Declining should discard the draft and show the normal setup screen instead.
- Check both light and dark theme.

Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add components/SplitForm.tsx app/app/page.tsx
git commit -m "Wire the live session into the app shell"
```

---

### Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `lib/liveSession.test.ts` and `lib/wakeLock.test.ts` suites, with no regressions to the existing suite (confirming Task 6's refactor was behavior-preserving).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds, no SCSS/type errors.

- [ ] **Step 3: Manual browser pass**

Run: `npm run dev`, then in a browser:
1. Complete a full live session end to end (as in Task 7's Step 5) for HYROX, confirm the resulting report's numbers make sense (each run/station split matches what was displayed on the live screen), and confirm entering an official finish time at the post-finish prompt produces a roxzone tax figure in the report.
2. Repeat for a TRYKA format, confirm the TRYKA-relabeled station names appear correctly on the live screen and in the resulting report.
3. Start a live session, tap a few laps, then use "Undo last lap" — confirm it removes exactly the last tap and lets you continue.
4. Confirm manual entry (`SplitForm`'s own "Generate report" submit) still works exactly as before — this is the regression check for Task 6's extraction.
5. Interrupt a live session (reload mid-session without finishing), click "Log live" again, confirm the resume prompt appears and correctly restores the in-progress draft.
6. Confirm both light and dark theme render correctly on the setup and live-tap screens.

Stop the dev server when done.

- [ ] **Step 4: Confirm no leftover temp files**

Run: `git status`
Expected: clean working tree.

---

## Summary of new/changed files

**New:**
- `lib/liveSession.ts`, `lib/liveSession.test.ts`
- `lib/wakeLock.ts`, `lib/wakeLock.test.ts`
- `components/StationProgressOctagon.tsx`
- `components/LiveSessionSetup.tsx`
- `components/LiveSessionTracker.tsx`
- `styles/_live-session.scss`

**Modified:**
- `styles/_report.scss` (pulse keyframe for `StationProgressOctagon`)
- `app/globals.scss` (new `@use`)
- `components/SplitForm.tsx` (new "Log live" button + prop)
- `app/app/page.tsx` (extracted `generateAndSaveReport`, new live-session state and screens)
