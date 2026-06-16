import { describe, expect, it } from "vitest";
import {
  computeBestEfforts,
  computeCardiacDecoupling,
  computeLTHR,
  computePaceZones,
  computeTrainingContext,
  computeTrainingLoad,
} from "./stravaMetrics";
import type { StravaActivity } from "./stravaTypes";

function makeRun(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 1,
    type: "Run",
    distance: 10000,
    moving_time: 3000,
    elapsed_time: 3100,
    average_speed: 3.33,
    start_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("computeTrainingContext", () => {
  it("returns zero metrics when no recent runs", () => {
    const result = computeTrainingContext([
      makeRun({ start_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() }),
    ]);
    expect(result.runsPerWeek).toBe(0);
    expect(result.weeklyDistanceKm).toBe(0);
  });

  it("calculates runsPerWeek over a 4-week window", () => {
    const runs = Array.from({ length: 8 }, (_, i) =>
      makeRun({ id: i, start_date: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000).toISOString() }),
    );
    const result = computeTrainingContext(runs);
    expect(result.runsPerWeek).toBe(2);
  });

  it("computes longestRunKm from max distance", () => {
    const result = computeTrainingContext([
      makeRun({ distance: 5000 }),
      makeRun({ distance: 21000 }),
      makeRun({ distance: 10000 }),
    ]);
    expect(result.longestRunKm).toBe(21);
  });
});

describe("computeBestEfforts", () => {
  it("returns null when no runs >= 3km", () => {
    const result = computeBestEfforts([makeRun({ distance: 2000 })]);
    expect(result.bestEffort5kSeconds).toBeNull();
    expect(result.bestEffort10kSeconds).toBeNull();
  });

  it("extrapolates 5k from a 10k run using Riegel formula", () => {
    const result = computeBestEfforts([makeRun({ distance: 10000, moving_time: 3000 })]);
    expect(result.bestEffort5kSeconds).toBeGreaterThan(1400);
    expect(result.bestEffort5kSeconds).toBeLessThan(1500);
  });

  it("returns the fastest projected time across multiple runs", () => {
    const fast = makeRun({ id: 1, distance: 10000, moving_time: 2400 });
    const slow = makeRun({ id: 2, distance: 10000, moving_time: 3600 });
    const result = computeBestEfforts([fast, slow]);
    expect(result.bestEffort5kSeconds).toBeLessThan(
      Math.round(3600 * Math.pow(5000 / 10000, 1.06)),
    );
  });
});

describe("computeLTHR", () => {
  it("returns null when no qualifying runs", () => {
    expect(computeLTHR([makeRun({ moving_time: 1000 })])).toBeNull();
  });

  it("returns 95% of highest average HR for qualifying runs", () => {
    const result = computeLTHR([
      makeRun({ moving_time: 2000, average_heartrate: 160 }),
      makeRun({ moving_time: 2000, average_heartrate: 170 }),
    ]);
    expect(result).toBe(Math.round(0.95 * 170));
  });
});

describe("computeCardiacDecoupling", () => {
  it("returns null with fewer than 2 long runs", () => {
    expect(
      computeCardiacDecoupling([makeRun({ moving_time: 3700, average_heartrate: 150 })]),
    ).toBeNull();
  });

  it("returns a non-negative percentage with 2+ long runs", () => {
    const runs = [
      makeRun({ id: 1, moving_time: 4000, average_heartrate: 150, average_speed: 3.0 }),
      makeRun({ id: 2, moving_time: 5000, average_heartrate: 165, average_speed: 2.8 }),
    ];
    const result = computeCardiacDecoupling(runs);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe("computeTrainingLoad", () => {
  it("returns 0 CTL and ATL with no runs", () => {
    const result = computeTrainingLoad([]);
    expect(result.ctlScore).toBe(0);
    expect(result.atlScore).toBe(0);
  });

  it("ATL responds faster than CTL to recent load", () => {
    const runs = Array.from({ length: 5 }, (_, i) =>
      makeRun({
        id: i,
        start_date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        moving_time: 3600,
        average_heartrate: 155,
      }),
    );
    const { ctlScore, atlScore } = computeTrainingLoad(runs);
    expect(atlScore).toBeGreaterThan(ctlScore);
  });
});

describe("computePaceZones", () => {
  it("returns null when bestEffort5kSeconds is null", () => {
    expect(computePaceZones(null)).toBeNull();
  });

  it("returns 5 zones with descending minPaceSec from z1 to z4", () => {
    const zones = computePaceZones(1200);
    expect(zones).not.toBeNull();
    expect(zones!.z1.minPaceSec).toBeGreaterThan(zones!.z2.minPaceSec);
    expect(zones!.z2.minPaceSec).toBeGreaterThan(zones!.z3.minPaceSec);
    expect(zones!.z3.minPaceSec).toBeGreaterThan(zones!.z4.minPaceSec);
  });
});
