import { Level, Station, StationKey, initialRuns, initialStations } from "./analysis";
import { RaceFormat, createCustomStation } from "./raceFormats";

export type ReportPreset = {
  raceFormat: RaceFormat;
  goal: string;
  targetTime: string;
  level: Level;
  runs: string[];
  stationDefinitions?: Station[];
  stationSplits: Record<StationKey, string>;
};

export const defaultReportPreset: ReportPreset = {
  raceFormat: "hyrox",
  goal: "Sub 1:25 at my next race",
  targetTime: "1:25:00",
  level: "competitive",
  runs: initialRuns,
  stationSplits: initialStations,
};

export const sampleReportPreset: ReportPreset = {
  raceFormat: "hyrox",
  goal: "Break 1:20 with cleaner sleds and late-run control",
  targetTime: "1:20:00",
  level: "competitive",
  runs: ["4:55", "4:58", "5:02", "5:06", "5:18", "5:24", "5:29", "5:36"],
  stationSplits: {
    ski: "4:18",
    sledPush: "5:45",
    sledPull: "6:20",
    burpees: "5:52",
    row: "4:38",
    farmers: "3:26",
    lunges: "5:22",
    wallBalls: "6:42",
  },
};

export const emptyReportPreset: ReportPreset = {
  raceFormat: "hyrox",
  goal: "",
  targetTime: "",
  level: "competitive",
  runs: Array.from({ length: 8 }, () => ""),
  stationSplits: {
    ski: "",
    sledPush: "",
    sledPull: "",
    burpees: "",
    row: "",
    farmers: "",
    lunges: "",
    wallBalls: "",
  },
};

export const defaultCustomReportPreset: ReportPreset = {
  raceFormat: "custom",
  goal: "Build a custom race simulation",
  targetTime: "45:00",
  level: "competitive",
  runs: ["5:00", "5:00", "5:00"],
  stationDefinitions: [
    createCustomStation("station-1", "Station 1"),
    createCustomStation("station-2", "Station 2"),
    createCustomStation("station-3", "Station 3"),
  ],
  stationSplits: {
    "station-1": "5:00",
    "station-2": "5:00",
    "station-3": "5:00",
  },
};

export const tryka800Preset: ReportPreset = {
  raceFormat: "tryka800",
  goal: "Strong TRYKA 800 finish with controlled running",
  targetTime: "1:05:00",
  level: "competitive",
  runs: ["4:05", "4:08", "4:10", "4:12", "4:18", "4:20", "4:24", "4:28"],
  stationSplits: {
    ski: "4:25",
    sledPush: "3:45",
    sledPull: "4:10",
    burpees: "4:40",
    row: "5:05",
    farmers: "4:35",
    lunges: "5:20",
    wallBalls: "5:55",
  },
};

export const tryka500Preset: ReportPreset = {
  raceFormat: "tryka500",
  goal: "Finish TRYKA 500 clean and controlled",
  targetTime: "52:00",
  level: "starter",
  runs: ["2:55", "2:58", "3:02", "3:05", "3:10", "3:12", "3:14", "3:18"],
  stationSplits: {
    ski: "5:10",
    sledPush: "4:20",
    sledPull: "4:45",
    burpees: "5:20",
    row: "5:45",
    farmers: "5:05",
    lunges: "6:00",
    wallBalls: "6:30",
  },
};

export function cloneReportPreset(preset: ReportPreset): ReportPreset {
  return {
    ...preset,
    runs: [...preset.runs],
    stationDefinitions: preset.stationDefinitions
      ? preset.stationDefinitions.map((station) => ({ ...station }))
      : undefined,
    stationSplits: { ...preset.stationSplits },
  };
}
