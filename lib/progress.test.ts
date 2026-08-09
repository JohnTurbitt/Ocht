import { describe, expect, it } from "vitest";
import { Station, initialStations } from "./analysis";
import {
  buildProgressSeries,
  groupKeyForReport,
  isNewPersonalBest,
} from "./progress";
import type { SavedReport } from "./reportStorage";

function makeReport(overrides: Partial<SavedReport> & { id: string }): SavedReport {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    raceFormat: "hyrox",
    goal: "",
    targetTime: "1:25:00",
    level: "competitive",
    runs: Array.from({ length: 8 }, () => "5:00"),
    stationSplits: { ...initialStations },
    finishSeconds: 0,
    predictedTargetSeconds: 0,
    topLeakLabel: "",
    ...overrides,
  };
}

function mkStation(key: string, label: string): Station {
  return {
    key,
    label,
    benchmarkSec: { starter: 300, competitive: 255, elite: 225 },
    recoverability: 0.5,
    raceImpact: 0.8,
    guidance: "",
  };
}

// Runs of 5:00 vs 4:50 across 8 runs => an 80s faster moving finish.
const slowRuns = Array.from({ length: 8 }, () => "5:00");
const fastRuns = Array.from({ length: 8 }, () => "4:50");

describe("buildProgressSeries", () => {
  it("orders points oldest-to-newest and finds the PB per format", () => {
    const series = buildProgressSeries([
      makeReport({ id: "b", createdAt: "2026-02-01T00:00:00.000Z", runs: fastRuns }),
      makeReport({ id: "a", createdAt: "2026-01-01T00:00:00.000Z", runs: slowRuns }),
    ]);

    expect(series.points.map((point) => point.id)).toEqual(["a", "b"]);

    const hyrox = series.groups.find((group) => group.key === "hyrox");
    expect(hyrox?.count).toBe(2);
    expect(hyrox?.pb.id).toBe("b");
    expect(hyrox?.latestIsPb).toBe(true);
    expect(hyrox?.improvementVsFirstSeconds).toBe(80);
  });

  it("does not flag the latest as a PB when an earlier report was faster", () => {
    const series = buildProgressSeries([
      makeReport({ id: "fast", createdAt: "2026-01-01T00:00:00.000Z", runs: fastRuns }),
      makeReport({ id: "slow", createdAt: "2026-02-01T00:00:00.000Z", runs: slowRuns }),
    ]);

    const hyrox = series.groups.find((group) => group.key === "hyrox");
    expect(hyrox?.pb.id).toBe("fast");
    expect(hyrox?.latestIsPb).toBe(false);
    expect(hyrox?.improvementVsFirstSeconds).toBe(-80);
  });

  it("keeps each race format separate and orders groups by recency", () => {
    const series = buildProgressSeries([
      makeReport({ id: "h1", raceFormat: "hyrox", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeReport({ id: "t1", raceFormat: "tryka500", createdAt: "2026-03-01T00:00:00.000Z" }),
    ]);

    expect(series.groups.map((group) => group.key)).toEqual(["tryka500", "hyrox"]);
  });

  it("handles empty and single-report inputs", () => {
    expect(buildProgressSeries([]).points).toEqual([]);

    const single = buildProgressSeries([makeReport({ id: "only" })]);
    const hyrox = single.groups.find((group) => group.key === "hyrox");
    expect(hyrox?.count).toBe(1);
    expect(hyrox?.pb.id).toBe("only");
    expect(hyrox?.latestIsPb).toBe(true);
    expect(hyrox?.improvementVsFirstSeconds).toBe(0);
  });
});

describe("custom race grouping", () => {
  const customA = makeReport({
    id: "ca",
    raceFormat: "custom",
    runs: ["5:00"],
    stationDefinitions: [mkStation("s1", "Wall walk")],
    stationSplits: { s1: "3:00" },
    finishSeconds: 480,
  });
  const customA2 = makeReport({
    id: "ca2",
    createdAt: "2026-02-01T00:00:00.000Z",
    raceFormat: "custom",
    runs: ["4:50"],
    stationDefinitions: [mkStation("s1", "Wall walk")],
    stationSplits: { s1: "3:00" },
  });
  const customB = makeReport({
    id: "cb",
    raceFormat: "custom",
    runs: ["5:00", "5:00"],
    stationDefinitions: [mkStation("s1", "Wall walk"), mkStation("s2", "Rope")],
    stationSplits: { s1: "3:00", s2: "2:00" },
  });

  it("shares a group key only for the same custom shape", () => {
    expect(groupKeyForReport(customA)).toBe(groupKeyForReport(customA2));
    expect(groupKeyForReport(customA)).not.toBe(groupKeyForReport(customB));
  });

  it("builds separate groups for distinct custom shapes", () => {
    const series = buildProgressSeries([customA, customA2, customB]);

    expect(series.groups).toHaveLength(2);
    const shapeA = series.groups.find(
      (group) => group.key === groupKeyForReport(customA),
    );
    expect(shapeA?.count).toBe(2);
  });

  it("only counts a PB against the same custom shape", () => {
    expect(isNewPersonalBest([customA], 400, groupKeyForReport(customA))).toBe(true);
    expect(isNewPersonalBest([customA], 400, groupKeyForReport(customB))).toBe(false);
  });
});

describe("isNewPersonalBest (standard formats)", () => {
  const prior = [makeReport({ id: "a", finishSeconds: 4965 })];

  it("is true when faster than every prior same-format report", () => {
    expect(isNewPersonalBest(prior, 4885, "hyrox")).toBe(true);
  });

  it("is false when not faster", () => {
    expect(isNewPersonalBest(prior, 5000, "hyrox")).toBe(false);
  });

  it("is false with no prior report of that format", () => {
    expect(isNewPersonalBest([], 4000, "hyrox")).toBe(false);
    expect(isNewPersonalBest(prior, 1, "tryka500")).toBe(false);
  });
});
