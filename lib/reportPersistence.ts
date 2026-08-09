import { Analysis, Level, Station, StationKey } from "./analysis";
import { RaceFormat } from "./raceFormats";
import { SavedReport } from "./reportStorage";
import { TrainingContext, sanitizeTrainingContext } from "./trainingContext";

export type PersistableReportInput = {
  raceFormat: RaceFormat;
  goal: string;
  targetTime: string;
  level: Level;
  runs: string[];
  stationDefinitions: Station[];
  stationSplits: Record<StationKey, string>;
  trainingContext?: TrainingContext;
  analysis: Analysis;
};

export type PersistableRaceReport = {
  raceFormat: RaceFormat;
  goal: string;
  targetTime: string;
  athleteLevel: "STARTER" | "COMPETITIVE" | "ELITE";
  runSplits: string[];
  stationSplits: Record<StationKey, string>;
  trainingContext?: TrainingContext;
  finishSeconds: number;
  predictedTargetSeconds: number;
  topLeakLabel: string;
  analysisSnapshot: Analysis;
};

export type PersistedReportSummary = Omit<
  PersistableRaceReport,
  "analysisSnapshot" | "raceFormat" | "trainingContext"
> & {
  id: string;
  createdAt: Date | string;
  raceFormat?: RaceFormat;
  trainingContext?: unknown;
  analysisSnapshot?: unknown;
};

const athleteLevelByLevel: Record<Level, PersistableRaceReport["athleteLevel"]> = {
  starter: "STARTER",
  competitive: "COMPETITIVE",
  elite: "ELITE",
};

const levelByAthleteLevel: Record<PersistableRaceReport["athleteLevel"], Level> = {
  STARTER: "starter",
  COMPETITIVE: "competitive",
  ELITE: "elite",
};

// Keep persistence concerns out of the analysis engine. The UI works with
// lowercase levels and `SavedReport`; Prisma stores enum values and JSON.
export function toPersistableRaceReport({
  raceFormat,
  goal,
  targetTime,
  level,
  runs,
  stationSplits,
  trainingContext,
  analysis,
}: PersistableReportInput): PersistableRaceReport {
  return {
    raceFormat,
    goal,
    targetTime,
    athleteLevel: athleteLevelByLevel[level],
    runSplits: runs,
    stationSplits,
    trainingContext,
    finishSeconds: analysis.finishSeconds,
    predictedTargetSeconds: analysis.predictedTargetSeconds,
    topLeakLabel: analysis.topLeaks[0]?.label ?? "",
    analysisSnapshot: analysis,
  };
}

function readRaceFormatFromSnapshot(snapshot: unknown): RaceFormat {
  if (
    typeof snapshot === "object" &&
    snapshot &&
    "raceFormat" in snapshot &&
    typeof snapshot.raceFormat === "string"
  ) {
    const value = snapshot.raceFormat;

    if (value === "hyrox" || value === "tryka800" || value === "tryka500") {
      return value;
    }
  }

  return "hyrox";
}

// Server-backed history should look like the existing local-storage history so
// the frontend can switch storage backends without changing report rendering.
export function toSavedReport(report: PersistedReportSummary): SavedReport {
  const raceFormat =
    report.raceFormat ?? readRaceFormatFromSnapshot(report.analysisSnapshot);

  return {
    id: report.id,
    createdAt:
      report.createdAt instanceof Date
        ? report.createdAt.toISOString()
        : report.createdAt,
    raceFormat,
    goal: report.goal,
    targetTime: report.targetTime,
    level: levelByAthleteLevel[report.athleteLevel],
    runs: report.runSplits,
    stationDefinitions:
      raceFormat === "custom"
        ? readStationDefinitionsFromSnapshot(report.analysisSnapshot)
        : undefined,
    stationSplits: report.stationSplits,
    trainingContext: sanitizeTrainingContext(report.trainingContext),
    finishSeconds: report.finishSeconds,
    predictedTargetSeconds: report.predictedTargetSeconds,
    topLeakLabel: report.topLeakLabel,
  };
}

function readStationDefinitionsFromSnapshot(snapshot: unknown) {
  if (
    typeof snapshot === "object" &&
    snapshot &&
    "stationDefinitions" in snapshot &&
    Array.isArray(snapshot.stationDefinitions)
  ) {
    return snapshot.stationDefinitions as Station[];
  }

  return undefined;
}
