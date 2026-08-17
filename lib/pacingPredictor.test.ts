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

  it("throws for raceFormat \"custom\" instead of silently returning a broken total", () => {
    expect(() =>
      buildPacingScenarios({
        targetSeconds: parseTime("1:15:00"),
        level: "competitive",
        raceFormat: "custom",
      }),
    ).toThrow();
  });
});
