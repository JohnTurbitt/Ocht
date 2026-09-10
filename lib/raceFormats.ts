import type { Level, Station, StationKey } from "./analysis";
import { stations } from "./analysis";

export type RaceFormat = "hyrox" | "tryka800" | "tryka500" | "custom";

// Baseline running pace per level, seconds per km, at a controlled
// race-day effort (not a max-effort standalone 1km time). Used only by
// the pacing predictor (lib/pacingPredictor.ts) to project a plan for
// someone who hasn't raced yet — real races always use actual splits
// instead of this baseline.
export const runPaceSecPerKm: Record<Level, number> = {
  starter: 345,
  competitive: 280,
  elite: 235,
};

export type RaceFormatOption = {
  id: RaceFormat;
  label: string;
  description: string;
  runLabel: string;
  runDistanceKm: number | null;
  stationHeading: string;
  stations: Station[];
};

function stationByKey(key: StationKey) {
  const station = stations.find((item) => item.key === key);

  if (!station) {
    throw new Error(`Station ${key} is not configured.`);
  }

  return station;
}

const trykaStationOverrides: Record<StationKey, string> = {
  ski: "SkiErg 1,000m",
  sledPush: "Farmers Carry 200m",
  sledPull: "Ram Thrusters 60 reps",
  burpees: "Sled Push 50m",
  row: "Sled Pull 50m",
  farmers: "Rower 1,000m",
  lunges: "Walking Lunges 100m",
  wallBalls: "Burpee Broad Jumps 80m",
};

function buildTrykaStations(): Station[] {
  return (Object.keys(trykaStationOverrides) as StationKey[]).map((key) => ({
    ...stationByKey(key),
    label: trykaStationOverrides[key],
  }));
}

export const raceFormatOptions: RaceFormatOption[] = [
  {
    id: "hyrox",
    label: "HYROX",
    description: "8 x 1km runs and the standard HYROX station order.",
    runLabel: "1km run",
    runDistanceKm: 1,
    stationHeading: "Stations",
    stations,
  },
  {
    id: "tryka800",
    label: "TRYKA 800",
    description: "8 x 800m runs with TRYKA stations.",
    runLabel: "800m run",
    runDistanceKm: 0.8,
    stationHeading: "TRYKA stations",
    stations: buildTrykaStations(),
  },
  {
    id: "tryka500",
    label: "TRYKA 500",
    description: "8 x 500m runs with TRYKA stations.",
    runLabel: "500m run",
    runDistanceKm: 0.5,
    stationHeading: "TRYKA stations",
    stations: buildTrykaStations(),
  },
];

export const raceFormatLabels: Record<RaceFormat, string> = {
  hyrox: "HYROX",
  tryka800: "TRYKA 800",
  tryka500: "TRYKA 500",
  custom: "Custom",
};

export function getRaceFormatOption(format: RaceFormat) {
  if (format === "custom") {
    return {
      id: "custom",
      label: "Custom",
      description: "Build your own race format.",
      runLabel: "run",
      runDistanceKm: null,
      stationHeading: "Custom stations",
      stations: [],
    } satisfies RaceFormatOption;
  }

  return raceFormatOptions.find((option) => option.id === format) ??
    raceFormatOptions[0];
}

export function getRaceFormatStations(format: RaceFormat) {
  return getRaceFormatOption(format).stations;
}

export function isRaceFormat(value: string): value is RaceFormat {
  return value === "custom" || raceFormatOptions.some((option) => option.id === value);
}

export function createCustomStation(key: string, label: string): Station {
  return {
    key,
    label,
    benchmarkSec: { starter: 300, competitive: 300, elite: 300 },
    recoverability: 0.5,
    raceImpact: 0.8,
    guidance:
      "Use repeatable technique and record a benchmark once this station is part of your template.",
  };
}
