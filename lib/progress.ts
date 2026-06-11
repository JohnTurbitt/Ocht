import { buildAnalysis } from "./analysis";
import { RaceFormat, getRaceFormatStations, raceFormatLabels } from "./raceFormats";
import { calculateRaceReadiness } from "./readiness";
import { SavedReport } from "./reportStorage";

export type ProgressPoint = {
  id: string;
  createdAt: string;
  raceFormat: RaceFormat;
  groupKey: string;
  groupLabel: string;
  finishSeconds: number;
  predictedTargetSeconds: number;
  targetSeconds: number;
  runFadeSeconds: number;
  targetGapSeconds: number;
  readiness: number;
  isPb: boolean;
};

export type ProgressSummary = {
  key: string;
  label: string;
  raceFormat: RaceFormat;
  count: number;
  points: ProgressPoint[];
  pb: ProgressPoint;
  latest: ProgressPoint;
  first: ProgressPoint;
  // Positive = the latest report is faster than the first (an improvement).
  improvementVsFirstSeconds: number;
  latestIsPb: boolean;
};

export type ProgressSeries = {
  points: ProgressPoint[];
  groups: ProgressSummary[];
};

function reportFormat(report: SavedReport): RaceFormat {
  return report.raceFormat ?? "hyrox";
}

// A comparison group: standard formats group by their format; custom races only
// group with other customs of the *same shape* (same run count + stations), so a
// "custom PB" never compares two different home-made layouts.
export function groupKeyForReport(report: SavedReport): string {
  const format = reportFormat(report);

  if (format !== "custom") {
    return format;
  }

  const signature =
    report.stationDefinitions && report.stationDefinitions.length > 0
      ? report.stationDefinitions.map((station) => station.label).join("|")
      : Object.keys(report.stationSplits).join("|");

  return `custom:${report.runs.length}:${signature}`;
}

export function groupLabelForReport(report: SavedReport): string {
  const format = reportFormat(report);

  if (format !== "custom") {
    return raceFormatLabels[format];
  }

  const stationCount =
    report.stationDefinitions?.length ??
    Object.keys(report.stationSplits).length;

  return `Custom · ${report.runs.length}r/${stationCount}s`;
}

function toPoint(report: SavedReport): ProgressPoint {
  const raceFormat = reportFormat(report);
  const stationDefinitions =
    report.stationDefinitions ?? getRaceFormatStations(raceFormat);
  const analysis = buildAnalysis(
    report.goal,
    report.targetTime,
    report.level,
    report.runs,
    report.stationSplits,
    stationDefinitions,
    raceFormat,
    report.officialFinishTime ?? "",
  );

  return {
    id: report.id,
    createdAt: report.createdAt,
    raceFormat,
    groupKey: groupKeyForReport(report),
    groupLabel: groupLabelForReport(report),
    finishSeconds: analysis.finishSeconds,
    predictedTargetSeconds: analysis.predictedTargetSeconds,
    targetSeconds: analysis.targetSeconds,
    runFadeSeconds: analysis.runFadeSeconds,
    targetGapSeconds: analysis.targetGapSeconds,
    readiness: calculateRaceReadiness(analysis).overall,
    isPb: false,
  };
}

// Builds the time-ordered progress series, grouped per comparison group so
// finish times are only ever compared like-for-like.
export function buildProgressSeries(reports: SavedReport[]): ProgressSeries {
  const points = reports
    .map(toPoint)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const byKey = new Map<string, ProgressSummary>();

  for (const point of points) {
    const existing = byKey.get(point.groupKey);

    if (existing) {
      existing.points.push(point);
    } else {
      byKey.set(point.groupKey, {
        key: point.groupKey,
        label: point.groupLabel,
        raceFormat: point.raceFormat,
        count: 0,
        points: [point],
        pb: point,
        latest: point,
        first: point,
        improvementVsFirstSeconds: 0,
        latestIsPb: true,
      });
    }
  }

  for (const summary of byKey.values()) {
    summary.count = summary.points.length;
    summary.first = summary.points[0];
    summary.latest = summary.points[summary.points.length - 1];

    // PB = fastest finish; on a tie keep the earliest (first to achieve it).
    let pb = summary.points[0];
    for (const point of summary.points) {
      if (point.finishSeconds < pb.finishSeconds) {
        pb = point;
      }
    }
    pb.isPb = true;
    summary.pb = pb;
    summary.latestIsPb = summary.latest.id === pb.id;
    summary.improvementVsFirstSeconds =
      summary.first.finishSeconds - summary.latest.finishSeconds;
  }

  // Groups ordered by recency (the group of the most recent report first).
  const orderedKeys = [...new Set([...points].reverse().map((p) => p.groupKey))];
  const groups = orderedKeys
    .map((key) => byKey.get(key))
    .filter((summary): summary is ProgressSummary => Boolean(summary));

  return { points, groups };
}

// Used at generate time: is `finishSeconds` faster than every prior report in
// the same comparison group? (No prior report in the group → not a "new" PB.)
export function isNewPersonalBest(
  priorReports: SavedReport[],
  finishSeconds: number,
  groupKey: string,
): boolean {
  const sameGroup = priorReports.filter(
    (report) => groupKeyForReport(report) === groupKey,
  );

  if (sameGroup.length === 0) {
    return false;
  }

  const best = Math.min(...sameGroup.map((report) => report.finishSeconds));

  return finishSeconds < best;
}
