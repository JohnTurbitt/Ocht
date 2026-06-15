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
    return "dark";
  }

  const savedTheme = readStorageWithLegacy(themeStorageKey, legacyThemeStorageKey);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  // Dark is the default skin; users can still switch to light (and that choice
  // is remembered). We intentionally do not follow the OS preference here.
  return "dark";
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

const avatarColorKey = "ocht.avatarColor";

// Brand-aligned accent palette for the user's avatar.
export const avatarColors = [
  "#c8ff2e",
  "#60c878",
  "#5ac8ff",
  "#ffb840",
  "#ff7a7a",
  "#b08cff",
];

export function readAvatarColor(): string {
  if (typeof window === "undefined") {
    return avatarColors[0];
  }

  const saved = window.localStorage.getItem(avatarColorKey);

  return saved && avatarColors.includes(saved) ? saved : avatarColors[0];
}

export function persistAvatarColor(color: string) {
  window.localStorage.setItem(avatarColorKey, color);
}

const avatarIconKey = "ocht.avatarIcon";

export function readAvatarIcon(): string {
  if (typeof window === "undefined") {
    return "initial";
  }

  return window.localStorage.getItem(avatarIconKey) ?? "initial";
}

export function persistAvatarIcon(icon: string) {
  window.localStorage.setItem(avatarIconKey, icon);
}
