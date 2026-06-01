import { NextRequest, NextResponse } from "next/server";
import { buildAnalysis, Level, Station, StationKey } from "@/lib/analysis";
import { requireCurrentUser } from "@/lib/apiAuth";
import { readString } from "@/lib/apiValidation";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import {
  RaceFormat,
  getRaceFormatStations,
  isRaceFormat,
} from "@/lib/raceFormats";
import {
  PersistedReportSummary,
  toPersistableRaceReport,
  toSavedReport,
} from "@/lib/reportPersistence";
import { guardBrowserMutation } from "@/lib/security";
import { validateReportInput } from "@/lib/validation";

const levels: Level[] = ["starter", "competitive", "elite"];

type RaceReportRecord = Omit<
  PersistedReportSummary,
  "stationSplits" | "analysisSnapshot"
> & {
  stationSplits: unknown;
  analysisSnapshot: unknown;
};

type ReportPayload = {
  raceFormat: RaceFormat;
  goal: string;
  targetTime: string;
  level: Level;
  runs: string[];
  stationDefinitions: Station[];
  stationSplits: Record<StationKey, string>;
};

function parseStationDefinitions(value: unknown): Station[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "object" && item ? item : null))
    .filter(Boolean)
    .map((item) => item as Record<string, unknown>)
    .map((item) => ({
      key: readString(item.key),
      label: readString(item.label),
      benchmarkSec: { starter: 300, competitive: 300, elite: 300 },
      recoverability: 0.5,
      raceImpact: 0.8,
      guidance:
        "Use repeatable technique and record a benchmark once this station is part of your template.",
    }))
    .filter((station) => station.key && station.label);
}

function parseReportPayload(payload: unknown): {
  errors: string[];
  value?: ReportPayload;
} {
  // Treat the request body as untrusted JSON and rebuild the typed report input
  // before running validation or analysis.
  const record = typeof payload === "object" && payload ? payload : {};
  const goal = readString((record as Record<string, unknown>).goal);
  const targetTime = readString((record as Record<string, unknown>).targetTime);
  const levelValue = readString((record as Record<string, unknown>).level);
  const raceFormatValue = readString(
    (record as Record<string, unknown>).raceFormat,
  );
  const raceFormat = isRaceFormat(raceFormatValue) ? raceFormatValue : "hyrox";
  const runsValue = (record as Record<string, unknown>).runs;
  const stationValue = (record as Record<string, unknown>).stationSplits;
  const stationDefinitionsValue = (record as Record<string, unknown>)
    .stationDefinitions;
  const errors: string[] = [];
  const stationDefinitions =
    raceFormat === "custom"
      ? parseStationDefinitions(stationDefinitionsValue)
      : getRaceFormatStations(raceFormat);

  if (!goal) {
    errors.push("Goal is required.");
  }

  if (!levels.includes(levelValue as Level)) {
    errors.push("Choose a valid athlete level.");
  }

  if (
    !Array.isArray(runsValue) ||
    (raceFormat === "custom" ? runsValue.length < 1 : runsValue.length !== 8)
  ) {
    errors.push(
      raceFormat === "custom"
        ? "Add at least one run split."
        : "Add exactly eight run splits.",
    );
  }

  if (raceFormat === "custom" && stationDefinitions.length === 0) {
    errors.push("Add at least one custom station.");
  }

  const runs = Array.isArray(runsValue) ? runsValue.map(readString) : [];
  const stationRecord =
    typeof stationValue === "object" && stationValue
      ? (stationValue as Record<string, unknown>)
      : {};
  const stationSplits = stationDefinitions.reduce(
    (splits, station) => ({
      ...splits,
      [station.key]: readString(stationRecord[station.key]),
    }),
    {} as Record<StationKey, string>,
  );
  const timeValidation = validateReportInput({
    targetTime,
    runs,
    stationSplits,
    stationDefinitions,
  });

  errors.push(...timeValidation.errors);

  if (errors.length > 0) {
    return { errors };
  }

  return {
    errors,
    value: {
      goal,
      targetTime,
      level: levelValue as Level,
      raceFormat,
      runs,
      stationDefinitions,
      stationSplits,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireCurrentUser(request);

    if (!user) {
      return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
    }

    const reports = await prisma.raceReport.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      reports: reports.map((report: RaceReportRecord) =>
        toSavedReport({
          id: report.id,
          createdAt: report.createdAt,
          goal: report.goal,
          targetTime: report.targetTime,
          athleteLevel: report.athleteLevel,
          runSplits: report.runSplits,
          stationSplits: report.stationSplits as Record<StationKey, string>,
          finishSeconds: report.finishSeconds,
          predictedTargetSeconds: report.predictedTargetSeconds,
          topLeakLabel: report.topLeakLabel,
          analysisSnapshot: report.analysisSnapshot,
        }),
      ),
    });
  } catch (error) {
    logServerError("Report history load failed", error);

    return NextResponse.json(
      { errors: ["Report history could not be loaded."] },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "reports-create",
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  try {
    const user = await requireCurrentUser(request);

    if (!user) {
      return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
    }

    const parsed = parseReportPayload(await request.json().catch(() => null));

    if (!parsed.value) {
      return NextResponse.json({ errors: parsed.errors }, { status: 400 });
    }

    // Recompute analysis server-side instead of trusting client-submitted totals.
    // That keeps saved reports consistent with the current deterministic model.
    const analysis = buildAnalysis(
      parsed.value.goal,
      parsed.value.targetTime,
      parsed.value.level,
      parsed.value.runs,
      parsed.value.stationSplits,
      getRaceFormatStations(parsed.value.raceFormat),
      parsed.value.raceFormat,
    );
    const reportData = toPersistableRaceReport({ ...parsed.value, analysis });
    const report = await prisma.raceReport.create({
      data: {
        userId: user.id,
        goal: reportData.goal,
        targetTime: reportData.targetTime,
        athleteLevel: reportData.athleteLevel,
        runSplits: reportData.runSplits,
        stationSplits: reportData.stationSplits,
        finishSeconds: reportData.finishSeconds,
        predictedTargetSeconds: reportData.predictedTargetSeconds,
        topLeakLabel: reportData.topLeakLabel,
        analysisSnapshot: reportData.analysisSnapshot,
      },
    });

    return NextResponse.json(
      {
        report: toSavedReport({
          ...reportData,
          id: report.id,
          createdAt: report.createdAt,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    logServerError("Report save failed", error);

    return NextResponse.json(
      { errors: ["Report could not be saved to your account."] },
      { status: 500 },
    );
  }
}
