"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  getCookieConsent,
  setCookieConsent,
} from "@/lib/cookieConsent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function checkConsent() {
      setVisible(getCookieConsent() === null);
    }

    checkConsent();
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, checkConsent);

    return () => window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, checkConsent);
  }, []);

  function resolve(choice: "accepted" | "declined") {
    setCookieConsent(choice);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie notice">
      <div className="cookie-banner__body">
        <strong>Cookies &amp; analytics</strong>
        <p>
          Ocht uses local storage to remember your settings and privacy-friendly
          analytics to improve the app. See our{" "}
          <Link href="/privacy">privacy policy</Link>.
        </p>
      </div>
      <div className="cookie-banner__actions">
        <button
          className="btn btn--secondary btn--sm"
          type="button"
          onClick={() => resolve("declined")}
        >
          Decline
        </button>
        <button
          className="btn btn--primary btn--sm"
          type="button"
          onClick={() => resolve("accepted")}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
