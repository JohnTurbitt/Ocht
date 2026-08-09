"use client";

export const COOKIE_CONSENT_KEY = "ocht.cookieConsent";
export const COOKIE_CONSENT_CHANGE_EVENT = "ocht:cookie-consent-change";

export type CookieConsent = "accepted" | "declined" | null;

export function getCookieConsent(): CookieConsent {
  const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);

  return value === "accepted" || value === "declined" ? value : null;
}

export function setCookieConsent(choice: "accepted" | "declined") {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

export function resetCookieConsent() {
  window.localStorage.removeItem(COOKIE_CONSENT_KEY);
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT));
}

export function hasAnalyticsConsent() {
  return getCookieConsent() === "accepted";
}
