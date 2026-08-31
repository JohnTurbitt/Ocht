import type { RaceFormat } from "./raceFormats";
import type { Station, StationKey } from "./analysis";
import { parseTime, stations } from "./analysis";
import { getRaceFormatOption, runPaceSecPerKm } from "./raceFormats";

export type ValidationInput = {
  targetTime: string;
  runs: string[];
  stationSplits: Record<StationKey, string>;
  stationDefinitions?: Station[];
  raceFormat?: RaceFormat;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
};

const timePattern = /^\d+(?::\d{1,2}){0,2}$/;

// No plausible race-day run/station effort beats the elite baseline by 2x —
// these floors exist purely to catch impossible/placeholder entries (e.g.
// "0:00"), not to be a tight bound. FLAT_MIN_PLAUSIBLE_SECONDS is the
// fallback used when there's no real calibrated data to derive a floor from
// (a custom race's run distance is unknown, and its stations use a flat
// placeholder benchmark — see createCustomStation in lib/raceFormats.ts).
const FLAT_MIN_PLAUSIBLE_SECONDS = 12;
const RUN_FLOOR_PACE_RATIO = 0.5;
const STATION_FLOOR_RATIO = 0.5;

function minPlausibleRunSeconds(raceFormat: RaceFormat): number {
  const { runDistanceKm } = getRaceFormatOption(raceFormat);

  if (runDistanceKm == null) {
    return FLAT_MIN_PLAUSIBLE_SECONDS;
  }

  return Math.max(
    FLAT_MIN_PLAUSIBLE_SECONDS,
    Math.round(runPaceSecPerKm.elite * RUN_FLOOR_PACE_RATIO * runDistanceKm),
  );
}

function minPlausibleStationSeconds(
  station: Station,
  raceFormat: RaceFormat,
): number {
  if (raceFormat === "custom") {
    return FLAT_MIN_PLAUSIBLE_SECONDS;
  }

  return Math.max(
    FLAT_MIN_PLAUSIBLE_SECONDS,
    Math.round(station.benchmarkSec.elite * STATION_FLOOR_RATIO),
  );
}

export function normalizeTimeInput(value: string, format: "split" | "race" = "split") {
  const trimmed = value.trim();

  if (!trimmed || trimmed.includes(":") || !/^\d+$/.test(trimmed)) {
    return value;
  }

  if (format === "race" && trimmed.length > 4) {
    const hours = trimmed.slice(0, -4);
    const minutes = trimmed.slice(-4, -2);
    const seconds = trimmed.slice(-2);

    return `${Number(hours)}:${minutes}:${seconds}`;
  }

  if (trimmed.length > 2) {
    const minutes = trimmed.slice(0, -2);
    const seconds = trimmed.slice(-2);

    return `${Number(minutes)}:${seconds}`;
  }

  return `0:${trimmed.padStart(2, "0")}`;
}

// Live input mask: formats raw keystrokes into mm:ss (or h:mm:ss for "race") as
// you type, using the same right-aligned digits as normalizeTimeInput so the
// last two digits are always the seconds. Empty stays empty; non-digits are
// stripped, so it is safe to re-run on an already-formatted value.
export function maskTimeInput(value: string, format: "split" | "race" = "split") {
  const max = format === "race" ? 6 : 4;
  const digits = value.replace(/\D/g, "").slice(-max);

  if (!digits) {
    return "";
  }

  if (format === "race" && digits.length > 4) {
    return `${Number(digits.slice(0, -4))}:${digits.slice(-4, -2)}:${digits.slice(-2)}`;
  }

  if (digits.length > 2) {
    return `${Number(digits.slice(0, -2))}:${digits.slice(-2)}`;
  }

  return `0:${digits.padStart(2, "0")}`;
}

export function isValidTime(value: string) {
  const trimmed = value.trim();

  if (!trimmed || !timePattern.test(trimmed)) {
    return false;
  }

  const parts = trimmed.split(":").map(Number);
  const minutes = parts.length === 3 ? parts[1] : parts.length === 2 ? parts[0] : 0;
  const seconds = parts.length > 1 ? parts[parts.length - 1] : 0;

  if (parts.some((part) => !Number.isInteger(part) || part < 0)) {
    return false;
  }

  if (parts.length > 1 && seconds > 59) {
    return false;
  }

  if (parts.length === 3 && minutes > 59) {
    return false;
  }

  return true;
}

export function validateReportInput({
  targetTime,
  runs,
  stationSplits,
  stationDefinitions = stations,
  raceFormat = "hyrox",
}: ValidationInput): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  if (!isValidTime(targetTime)) {
    const message = "Enter a valid target time, for example 1:25:00.";
    errors.push(message);
    fieldErrors.targetTime = message;
  }

  const runFloorSeconds = minPlausibleRunSeconds(raceFormat);

  runs.forEach((split, index) => {
    if (!isValidTime(split)) {
      const message = `Run ${index + 1} needs a valid time, for example 5:30.`;
      errors.push(message);
      fieldErrors[`run-${index}`] = "Use a valid time like 5:30.";
    } else if (parseTime(split) < runFloorSeconds) {
      const message = `Run ${index + 1} is faster than physically possible — check this split.`;
      errors.push(message);
      fieldErrors[`run-${index}`] = "That's faster than physically possible.";
    }
  });

  stationDefinitions.forEach((station) => {
    if (!station.label.trim()) {
      const message = "Each custom station needs a name.";
      errors.push(message);
      fieldErrors[`station-${station.key}-label`] = message;
    }

    if (!isValidTime(stationSplits[station.key])) {
      const message = `${station.label} needs a valid time, for example 5:00.`;
      errors.push(message);
      fieldErrors[`station-${station.key}`] = "Use a valid time like 5:00.";
    } else if (
      parseTime(stationSplits[station.key]) <
      minPlausibleStationSeconds(station, raceFormat)
    ) {
      const message = `${station.label} is faster than physically possible — check this split.`;
      errors.push(message);
      fieldErrors[`station-${station.key}`] =
        "That's faster than physically possible.";
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
}
