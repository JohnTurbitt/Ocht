import { describe, expect, it } from "vitest";
import { buildAnalysis, initialRuns, initialStations } from "./analysis";
import { toPersistableRaceReport, toSavedReport } from "./reportPersistence";

describe("report persistence mapping", () => {
  it("maps a generated report into the database shape", () => {
    const analysis = buildAnalysis(
      "Sub 1:25",
      "1:25:00",
      "competitive",
      initialRuns,
      initialStations,
    );

    const report = toPersistableRaceReport({
      raceFormat: "hyrox",
      goal: "Sub 1:25",
      targetTime: "1:25:00",
      level: "competitive",
      runs: initialRuns,
      stationDefinitions: analysis.stationDefinitions,
      stationSplits: initialStations,
      analysis,
    });

    expect(report.athleteLevel).toBe("COMPETITIVE");
    expect(report.raceFormat).toBe("hyrox");
    expect(report.runSplits).toEqual(initialRuns);
    expect(report.stationSplits.wallBalls).toBe(initialStations.wallBalls);
    expect(report.finishSeconds).toBe(analysis.finishSeconds);
    expect(report.analysisSnapshot.topLeaks).toEqual(analysis.topLeaks);
  });

  it("maps a persisted report back into the saved-report view shape", () => {
    const savedReport = toSavedReport({
      id: "report_1",
      createdAt: new Date("2026-04-28T12:00:00.000Z"),
      goal: "Podium attempt",
      targetTime: "1:18:00",
      athleteLevel: "ELITE",
      runSplits: initialRuns,
      stationSplits: initialStations,
      finishSeconds: 5000,
      predictedTargetSeconds: 4800,
      topLeakLabel: "Wall balls",
      analysisSnapshot: buildAnalysis(
        "Podium attempt",
        "1:18:00",
        "elite",
        initialRuns,
        initialStations,
      ),
    });

    expect(savedReport.level).toBe("elite");
    expect(savedReport.createdAt).toBe("2026-04-28T12:00:00.000Z");
    expect(savedReport.runs).toEqual(initialRuns);
    expect(savedReport.raceFormat).toBe("hyrox");
  });
});
