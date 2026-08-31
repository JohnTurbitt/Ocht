import { describe, expect, it } from "vitest";
import {
  StationKey,
  buildAnalysis,
  formatTime,
  initialStations,
  parseTime,
} from "./analysis";

const steadyRuns = Array.from({ length: 8 }, () => "5:00");

const stationSplits: Record<StationKey, string> = {
  ...initialStations,
  wallBalls: "8:00",
  sledPull: "7:00",
};

describe("time helpers", () => {
  it("parses hours, minutes and seconds", () => {
    expect(parseTime("1:25:00")).toBe(5100);
  });

  it("parses minutes and seconds", () => {
    expect(parseTime("5:30")).toBe(330);
  });

  it("formats seconds into race time", () => {
    expect(formatTime(5100)).toBe("1:25:00");
  });
});

describe("buildAnalysis", () => {
  it("calculates target gap from projected finish", () => {
    const analysis = buildAnalysis(
      "Sub 1:25",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
    );

    expect(analysis.finishSeconds).toBe(5105);
    expect(analysis.targetGapSeconds).toBe(5);
    expect(analysis.requiredGainSeconds).toBe(5);
    expect(analysis.requiredGainPerRunSeconds).toBe(0.625);
  });

  it("builds target math for an aggressive target", () => {
    const analysis = buildAnalysis(
      "Find three minutes",
      "1:22:05",
      "competitive",
      steadyRuns,
      stationSplits,
    );

    expect(analysis.requiredGainSeconds).toBe(180);
    expect(analysis.targetDifficulty).toBe("aggressive");
    expect(analysis.targetPlanSummary).toContain("find 3:00 total");
    expect(analysis.targetRunAverageSeconds).toBeLessThan(
      analysis.averageRunSeconds,
    );
    expect(analysis.targetStationAverageSeconds).toBeLessThan(
      analysis.totalStationSeconds / analysis.stationResults.length,
    );
  });

  it("calculates second-half run fade per kilometre", () => {
    const analysis = buildAnalysis(
      "Even pacing",
      "1:25:00",
      "competitive",
      ["5:00", "5:00", "5:00", "5:00", "5:20", "5:20", "5:20", "5:20"],
      initialStations,
    );

    expect(analysis.runFadeSeconds).toBe(20);
  });

  it("ranks the highest scoring time leak first", () => {
    const analysis = buildAnalysis(
      "Fix the worst station",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
    );

    expect(analysis.topLeaks[0].id).toBe("wallBalls");
    expect(analysis.topLeaks[0].recoverableSeconds).toBe(86);
  });

  it("builds ordered race segments for visual reports", () => {
    const analysis = buildAnalysis(
      "Visual report",
      "1:22:05",
      "competitive",
      steadyRuns,
      stationSplits,
    );

    expect(analysis.raceSegments).toHaveLength(16);
    expect(analysis.raceSegments[0]).toMatchObject({
      id: "run-1",
      label: "Run 1",
      type: "run",
    });
    expect(analysis.raceSegments[1]).toMatchObject({
      id: "station-ski",
      label: "SkiErg",
      type: "station",
    });
    expect(
      analysis.raceSegments.reduce(
        (total, segment) => total + segment.actualSeconds,
        0,
      ),
    ).toBe(analysis.finishSeconds);
  });

  it("changes station benchmarks when athlete level changes", () => {
    const starter = buildAnalysis(
      "Starter benchmark",
      "1:25:00",
      "starter",
      steadyRuns,
      initialStations,
    );
    const elite = buildAnalysis(
      "Elite benchmark",
      "1:25:00",
      "elite",
      steadyRuns,
      initialStations,
    );

    const starterWallBalls = starter.stationResults.find(
      (station) => station.key === "wallBalls",
    );
    const eliteWallBalls = elite.stationResults.find(
      (station) => station.key === "wallBalls",
    );

    expect(starterWallBalls?.benchmark).toBe(450);
    expect(eliteWallBalls?.benchmark).toBe(300);
    expect(starterWallBalls?.gap).toBe(0);
    expect(eliteWallBalls?.gap).toBe(110);
    expect(elite.levelLabel).toBe("Elite");
    expect(elite.stationBenchmarkSummary).toContain("Elite benchmarks");
  });

  it("caps recoverable time at twelve percent of projected finish", () => {
    const slowStations: Record<StationKey, string> = {
      ski: "20:00",
      sledPush: "20:00",
      sledPull: "20:00",
      burpees: "20:00",
      row: "20:00",
      farmers: "20:00",
      lunges: "20:00",
      wallBalls: "20:00",
    };

    const analysis = buildAnalysis(
      "Huge improvement target",
      "1:25:00",
      "elite",
      steadyRuns,
      slowStations,
    );

    expect(analysis.recoverableSeconds).toBe(
      Math.round(analysis.finishSeconds * 0.12),
    );
  });

  it("builds a four-week plan from the ranked leaks", () => {
    const analysis = buildAnalysis(
      "Fix the worst station",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
    );

    expect(analysis.trainingPlan).toHaveLength(4);
    expect(analysis.trainingPlan[0].focus).toContain("Wall balls");
    expect(analysis.trainingPlan[0].sessions[0]).toBe(
      analysis.topLeaks[0].recommendation,
    );
    expect(analysis.trainingPlan[3].target).toContain(
      formatTime(analysis.predictedTargetSeconds),
    );
  });
});

describe("roxzone (transition time)", () => {
  it("isolates roxzone from an official finish time", () => {
    const analysis = buildAnalysis(
      "Find the dead time",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
      undefined,
      "hyrox",
      "1:30:00",
    );

    expect(analysis.finishSeconds).toBe(5105);
    expect(analysis.officialFinishSeconds).toBe(5400);
    expect(analysis.hasRoxzone).toBe(true);
    expect(analysis.roxzoneSeconds).toBe(295);
    expect(analysis.roxzonePercent).toBeCloseTo(295 / 5400, 4);
    expect(analysis.roxzonePerTransitionSeconds).toBeCloseTo(295 / 8, 3);
  });

  it("reports no roxzone without an official finish time", () => {
    const analysis = buildAnalysis(
      "No chip time",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
    );

    expect(analysis.hasRoxzone).toBe(false);
    expect(analysis.roxzoneSeconds).toBe(0);
    expect(analysis.roxzonePercent).toBe(0);
  });

  it("ignores an official finish at or under the moving time", () => {
    const analysis = buildAnalysis(
      "Bad chip time",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
      undefined,
      "hyrox",
      "1:20:00",
    );

    expect(analysis.officialFinishSeconds).toBe(4800);
    expect(analysis.hasRoxzone).toBe(false);
    expect(analysis.roxzoneSeconds).toBe(0);
  });
});

describe("athlete archetype", () => {
  it("classifies Fionn mac Cumhaill when stations leak more than the runs", () => {
    const analysis = buildAnalysis(
      "Strong engine",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
    );

    expect(analysis.archetype.id).toBe("fionn");
    expect(analysis.archetype.scores.durability).toBeGreaterThanOrEqual(55);
  });

  it("classifies Setanta on wild, inconsistent pacing", () => {
    const fadingRuns = [
      "5:00",
      "5:00",
      "5:00",
      "5:00",
      "6:30",
      "6:30",
      "6:30",
      "6:30",
    ];
    const analysis = buildAnalysis(
      "Late-race fade",
      "1:25:00",
      "competitive",
      fadingRuns,
      stationSplits,
    );

    expect(analysis.archetype.id).toBe("setanta");
    expect(analysis.archetype.scores.durability).toBeLessThan(55);
  });

  it("classifies The Morrígan when transitions dominate", () => {
    const analysis = buildAnalysis(
      "Slow transitions",
      "1:25:00",
      "competitive",
      steadyRuns,
      stationSplits,
      undefined,
      "hyrox",
      "1:32:30",
    );

    expect(analysis.hasRoxzone).toBe(true);
    expect(analysis.archetype.id).toBe("morrigan");
  });

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
