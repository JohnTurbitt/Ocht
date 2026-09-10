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
    // Full sequence, in order, cross-checked against the real HYROX station
    // list in lib/analysis.ts (ski, sledPush, sledPull, burpees, row,
    // farmers, lunges, wallBalls) — not just the first pair.
    expect(sequence).toEqual([
      { type: "run", key: "run-1", label: "Run 1" },
      { type: "station", key: "ski", label: "SkiErg" },
      { type: "run", key: "run-2", label: "Run 2" },
      { type: "station", key: "sledPush", label: "Sled push" },
      { type: "run", key: "run-3", label: "Run 3" },
      { type: "station", key: "sledPull", label: "Sled pull" },
      { type: "run", key: "run-4", label: "Run 4" },
      { type: "station", key: "burpees", label: "Burpee broad jumps" },
      { type: "run", key: "run-5", label: "Run 5" },
      { type: "station", key: "row", label: "Row" },
      { type: "run", key: "run-6", label: "Run 6" },
      { type: "station", key: "farmers", label: "Farmers carry" },
      { type: "run", key: "run-7", label: "Run 7" },
      { type: "station", key: "lunges", label: "Sandbag lunges" },
      { type: "run", key: "run-8", label: "Run 8" },
      { type: "station", key: "wallBalls", label: "Wall balls" },
    ]);
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

  it("startDraft sets currentSegmentStartedAt to the same moment as startedAt", () => {
    const draft = startDraft("hyrox", "competitive", "1:15:00", "2026-01-01T00:00:00.000Z");
    expect(draft.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(draft.currentSegmentStartedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("recordLap advances currentSegmentStartedAt to the moment the lap was recorded", () => {
    let draft = startDraft("hyrox", "competitive", "1:15:00", "2026-01-01T00:00:00.000Z");
    draft = recordLap(draft, 280, "2026-01-01T00:04:40.000Z");
    expect(draft.currentSegmentStartedAt).toBe("2026-01-01T00:04:40.000Z");

    draft = recordLap(draft, 250, "2026-01-01T00:08:50.000Z");
    expect(draft.currentSegmentStartedAt).toBe("2026-01-01T00:08:50.000Z");
  });

  it("recordLap past completion leaves currentSegmentStartedAt untouched (no-op)", () => {
    let draft = startDraft("hyrox", "competitive", "", "2026-01-01T00:00:00.000Z");
    for (let i = 0; i < 16; i++) {
      draft = recordLap(draft, 200, `2026-01-01T00:0${i % 10}:00.000Z`);
    }
    const before = draft.currentSegmentStartedAt;

    const overTapped = recordLap(draft, 999, "2099-01-01T00:00:00.000Z");
    expect(overTapped.currentSegmentStartedAt).toBe(before);
  });

  it("undoLastLap resets currentSegmentStartedAt to the moment of the undo", () => {
    let draft = startDraft("hyrox", "competitive", "", "2026-01-01T00:00:00.000Z");
    draft = recordLap(draft, 280, "2026-01-01T00:04:40.000Z");
    draft = recordLap(draft, 250, "2026-01-01T00:08:50.000Z");

    draft = undoLastLap(draft, "2026-01-01T00:10:00.000Z");
    expect(draft.currentSegmentStartedAt).toBe("2026-01-01T00:10:00.000Z");
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

    // Full runs array and full stationSplits object, in the real HYROX
    // station order from lib/analysis.ts (ski, sledPush, sledPull, burpees,
    // row, farmers, lunges, wallBalls) — not just the first and last
    // segments, so an off-by-one in the interleaving loop can't slip through.
    expect(runs).toEqual([
      "4:40", "4:45", "4:50", "4:48", "4:52", "4:49", "4:51", "4:53",
    ]);
    expect(stationSplits).toEqual({
      ski: "4:10",
      sledPush: "5:00",
      sledPull: "4:00",
      burpees: "5:50",
      row: "3:10",
      farmers: "3:30",
      lunges: "5:35",
      wallBalls: "6:50",
    });
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
