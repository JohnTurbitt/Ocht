import type { DistanceUnit } from "./units";

export type Theme = "light" | "dark";

const themeStorageKey = "ocht.theme";
const unitStorageKey = "ocht.distanceUnit";
const legacyThemeStorageKey = "reprun.theme";
const legacyUnitStorageKey = "reprun.distanceUnit";

function readStorageWithLegacy(key: string, legacyKey: string) {
  const value = window.localStorage.getItem(key);

  if (value !== null) {
    return value;
  }

  const legacyValue = window.localStorage.getItem(legacyKey);

  if (legacyValue !== null) {
    window.localStorage.setItem(key, legacyValue);
  }

  return legacyValue;
}

export function readPreferredTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = readStorageWithLegacy(themeStorageKey, legacyThemeStorageKey);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function persistTheme(theme: Theme) {
  window.localStorage.setItem(themeStorageKey, theme);
}

export function readPreferredDistanceUnit(): DistanceUnit {
  if (typeof window === "undefined") {
    return "km";
  }

  const savedUnit = readStorageWithLegacy(unitStorageKey, legacyUnitStorageKey);

  return savedUnit === "mi" ? "mi" : "km";
}

export function persistDistanceUnit(unit: DistanceUnit) {
  window.localStorage.setItem(unitStorageKey, unit);
}
