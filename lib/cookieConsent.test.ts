import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  getCookieConsent,
  hasAnalyticsConsent,
  resetCookieConsent,
  setCookieConsent,
} from "./cookieConsent";

function makeWindowStub() {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<(event: Event) => void>>();

  return {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
    addEventListener: (type: string, listener: (event: Event) => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, listener: (event: Event) => void) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("window", makeWindowStub());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cookie consent", () => {
  it("defaults to null when nothing is saved", () => {
    expect(getCookieConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("round-trips an accepted choice and reports analytics consent", () => {
    setCookieConsent("accepted");

    expect(getCookieConsent()).toBe("accepted");
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("round-trips a declined choice without analytics consent", () => {
    setCookieConsent("declined");

    expect(getCookieConsent()).toBe("declined");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("dispatches a change event when consent is set", () => {
    const listener = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);

    setCookieConsent("accepted");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears consent and dispatches a change event on reset", () => {
    setCookieConsent("accepted");

    const listener = vi.fn();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, listener);

    resetCookieConsent();

    expect(getCookieConsent()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
