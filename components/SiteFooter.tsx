"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { resetCookieConsent } from "@/lib/cookieConsent";

export function SiteFooter() {
  const pathname = usePathname();

  // The live tap-to-lap tracker is a full-screen, dark-only recording
  // screen (styles/_live-session.scss) — the marketing/legal footer has
  // no place there and just eats space below the fold.
  if (pathname?.startsWith("/app/live")) {
    return null;
  }

  return (
    <footer className="site-footer">
      <div>
        <strong>Ocht</strong>
        <span>Hybrid race split analytics.</span>
      </div>
      <nav aria-label="Trust and legal links">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/calculations">Calculations</Link>
        <Link href="/refunds">Refunds</Link>
        <Link href="/contact">Contact</Link>
        <a href="mailto:support@ocht.app?subject=Ocht%20beta%20feedback">
          Feedback
        </a>
        <button
          type="button"
          className="site-footer__link"
          onClick={() => resetCookieConsent()}
        >
          Cookie preferences
        </button>
      </nav>
    </footer>
  );
}
