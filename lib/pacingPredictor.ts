import { Level, formatTime } from "./analysis";
import { RaceFormat, getRaceFormatOption, runPaceSecPerKm } from "./raceFormats";
import { getRunDistanceKm } from "./units";

export type PacingSegment = {
  id: string;
  label: string;
  type: "run" | "station";
  seconds: number;
};

export type PacingScenario = {
  id: "balanced" | "run-focused" | "station-focused";
  label: string;
  note: string;
  segments: PacingSegment[];
  totalSeconds: number;
  totalLabel: string;
};

export type PacingScenarioInput = {
  targetSeconds: number;
  level: Level;
  raceFormat: RaceFormat;
};

const RUN_LEG_COUNT = 8;

function buildSegments(
  raceFormat: RaceFormat,
  runSecondsPerLeg: number,
  stationScale: number,
  level: Level,
): PacingSegment[] {
  const format = getRaceFormatOption(raceFormat);
  const segments: PacingSegment[] = [];

  for (let i = 0; i < RUN_LEG_COUNT; i++) {
    segments.push({
      id: `run-${i + 1}`,
      label: `Run ${i + 1}`,
      type: "run",
      seconds: runSecondsPerLeg,
    });

    const station = format.stations[i];
    if (station) {
      segments.push({
        id: `station-${station.key}`,
        label: station.label,
        type: "station",
        seconds: station.benchmarkSec[level] * stationScale,
      });
    }
  }

  return segments;
}

function scenarioTotal(segments: PacingSegment[]): number {
  return segments.reduce((sum, seg) => sum + seg.seconds, 0);
}

export function buildPacingScenarios({
  targetSeconds,
  level,
  raceFormat,
}: PacingScenarioInput): PacingScenario[] {
  if (raceFormat === "custom") {
    throw new Error(
      "buildPacingScenarios does not support raceFormat \"custom\" — it has no stations to pace against.",
    );
  }

  const format = getRaceFormatOption(raceFormat);
  const legDistanceKm = getRunDistanceKm(raceFormat);
  const runBenchmarkPerLeg = runPaceSecPerKm[level] * legDistanceKm;
  const runBenchmarkTotal = runBenchmarkPerLeg * RUN_LEG_COUNT;
  const stationBenchmarkTotal = format.stations.reduce(
    (sum, station) => sum + station.benchmarkSec[level],
    0,
  );
  const baselineTotal = runBenchmarkTotal + stationBenchmarkTotal;

  // Balanced: uniform scale across every run and station.
  const balancedScale = targetSeconds / baselineTotal;
  const balancedRunPerLeg = runBenchmarkPerLeg * balancedScale;
  const balancedSegments = buildSegments(raceFormat, balancedRunPerLeg, balancedScale, level);

  // Run-focused: runs 10% faster than balanced; stations absorb the rest.
  const runFocusedRunPerLeg = balancedRunPerLeg * 0.9;
  const runFocusedRunTotal = runFocusedRunPerLeg * RUN_LEG_COUNT;
  const runFocusedStationScale =
    (targetSeconds - runFocusedRunTotal) / stationBenchmarkTotal;
  const runFocusedSegments = buildSegments(
    raceFormat,
    runFocusedRunPerLeg,
    runFocusedStationScale,
    level,
  );

  // Station-focused: stations 10% faster than balanced; runs absorb the rest.
  const stationFocusedScale = balancedScale * 0.9;
  const stationFocusedStationTotal = stationBenchmarkTotal * stationFocusedScale;
  const stationFocusedRunPerLeg =
    (targetSeconds - stationFocusedStationTotal) / RUN_LEG_COUNT;
  const stationFocusedSegments = buildSegments(
    raceFormat,
    stationFocusedRunPerLeg,
    stationFocusedScale,
    level,
  );

  return [
    {
      id: "balanced",
      label: "Balanced",
      note: `Every station and run scaled by the same factor from your ${format.label} benchmark — assumes fairly even strength across running and stations.`,
      segments: balancedSegments,
      totalSeconds: scenarioTotal(balancedSegments),
      totalLabel: formatTime(scenarioTotal(balancedSegments)),
    },
    {
      id: "run-focused",
      label: "Run-focused",
      note: "Runs paced faster than balanced, stations carry the rest of the budget — for athletes whose running is ahead of their station strength.",
      segments: runFocusedSegments,
      totalSeconds: scenarioTotal(runFocusedSegments),
      totalLabel: formatTime(scenarioTotal(runFocusedSegments)),
    },
    {
      id: "station-focused",
      label: "Station-focused",
      note: "Stations paced faster than balanced, runs carry the rest of the budget — for athletes whose station strength is ahead of their running.",
      segments: stationFocusedSegments,
      totalSeconds: scenarioTotal(stationFocusedSegments),
      totalLabel: formatTime(scenarioTotal(stationFocusedSegments)),
    },
  ];
}
