"use client";

import { Analytics } from "@vercel/analytics/next";
import { useEffect, useState } from "react";
import { COOKIE_CONSENT_CHANGE_EVENT, hasAnalyticsConsent } from "@/lib/cookieConsent";

export function ConsentedAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const update = () => setConsented(hasAnalyticsConsent());

    update();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, update);

    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, update);
  }, []);

  if (!consented) {
    return null;
  }

  return <Analytics />;
}
