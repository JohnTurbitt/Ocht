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
