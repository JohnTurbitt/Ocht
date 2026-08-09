import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  avatarColors,
  persistAvatarColor,
  persistAvatarIcon,
  persistDistanceUnit,
  persistTheme,
  readAvatarColor,
  readAvatarIcon,
  readPreferredDistanceUnit,
  readPreferredTheme,
} from "./preferences";

function makeStorage() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

let prefersDark = false;

beforeEach(() => {
  vi.stubGlobal("window", {
    localStorage: makeStorage(),
    matchMedia: () => ({ matches: prefersDark }),
  });
});

afterEach(() => {
  prefersDark = false;
  vi.unstubAllGlobals();
});

describe("distance unit preference", () => {
  it("defaults to km and round-trips a saved value", () => {
    expect(readPreferredDistanceUnit()).toBe("km");
    persistDistanceUnit("mi");
    expect(readPreferredDistanceUnit()).toBe("mi");
  });
});

describe("theme preference", () => {
  it("defaults to dark when nothing is saved, ignoring the OS preference", () => {
    prefersDark = false;
    expect(readPreferredTheme()).toBe("dark");
  });

  it("prefers a saved theme over the default", () => {
    persistTheme("light");
    expect(readPreferredTheme()).toBe("light");
  });
});

describe("avatar colour preference", () => {
  it("defaults to the first palette colour", () => {
    expect(readAvatarColor()).toBe(avatarColors[0]);
  });

  it("round-trips a valid palette colour", () => {
    persistAvatarColor(avatarColors[2]);
    expect(readAvatarColor()).toBe(avatarColors[2]);
  });

  it("ignores a colour outside the palette", () => {
    persistAvatarColor("#123456");
    expect(readAvatarColor()).toBe(avatarColors[0]);
  });
});

describe("avatar icon preference", () => {
  it("defaults to the initial and round-trips a saved icon", () => {
    expect(readAvatarIcon()).toBe("initial");
    persistAvatarIcon("bolt");
    expect(readAvatarIcon()).toBe("bolt");
  });
});
