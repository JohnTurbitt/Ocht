import type { Station, StationKey } from "./analysis";
import { stations } from "./analysis";

export type ValidationInput = {
  targetTime: string;
  runs: string[];
  stationSplits: Record<StationKey, string>;
  stationDefinitions?: Station[];
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
};

const timePattern = /^\d+(?::\d{1,2}){0,2}$/;

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
}: ValidationInput): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  if (!isValidTime(targetTime)) {
    const message = "Enter a valid target time, for example 1:25:00.";
    errors.push(message);
    fieldErrors.targetTime = message;
  }

  runs.forEach((split, index) => {
    if (!isValidTime(split)) {
      const message = `Run ${index + 1} needs a valid time, for example 5:30.`;
      errors.push(message);
      fieldErrors[`run-${index}`] = "Use a valid time like 5:30.";
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
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
}
