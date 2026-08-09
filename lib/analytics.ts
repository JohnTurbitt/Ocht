"use client";

import { track } from "@vercel/analytics";
import { hasAnalyticsConsent } from "./cookieConsent";

type AnalyticsValue = string | number | boolean | null;
type AnalyticsProperties = Record<string, AnalyticsValue>;

const enabled =
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" ||
  process.env.NODE_ENV === "production";

export function trackEvent(name: string, properties: AnalyticsProperties = {}) {
  if (!enabled || !hasAnalyticsConsent()) {
    return;
  }

  track(name, properties);
}
