import type { Metadata } from "next";
import Link from "next/link";
import { OchtShield } from "@/components/OchtShield";
import { PacingCalculator } from "@/components/PacingCalculator";

const pageDescription =
  "Free HYROX and TRYKA pacing calculator. Enter your target finish time and get three realistic split-by-split plans — balanced, run-focused, and station-focused. No signup required.";

export const metadata: Metadata = {
  title: "HYROX Pacing Calculator",
  description: pageDescription,
  alternates: { canonical: "/hyrox-pacing-calculator" },
  openGraph: {
    type: "website",
    url: "/hyrox-pacing-calculator",
    title: "HYROX Pacing Calculator - Ocht",
    description: pageDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "HYROX Pacing Calculator - Ocht",
    description: pageDescription,
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "HYROX Pacing Calculator",
  applicationCategory: "SportsApplication",
  operatingSystem: "Web",
  description: pageDescription,
};

export default function PacingCalculatorPage() {
  return (
    <main className="format-page pacing-calculator-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <header className="landing-header">
        <Link className="landing-header__brand" href="/">
          <OchtShield className="landing-header__shield" size={22} />
          <span className="landing-header__wordmark">
            ocht<em>.</em>
          </span>
        </Link>
        <nav className="landing-header__actions" aria-label="Site">
          <Link href="/what-is-hyrox">What is HYROX?</Link>
          <Link href="/what-is-tryka">What is TRYKA?</Link>
          <Link href="/hyrox-pacing-calculator">Pacing calculator</Link>
          <Link href="/app?auth=login">Log in</Link>
          <Link className="btn btn--primary btn--sm" href="/app?auth=signup">
            Sign up free
          </Link>
        </nav>
      </header>

      <section className="format-hero">
        <div className="format-hero__text">
          <p className="format-hero__eyebrow">Free pacing tool · no signup required</p>
          <h1>HYROX pacing calculator</h1>
          <p className="format-hero__dek">
            Enter the finish time you&apos;re aiming for and Ocht builds three
            realistic split-by-split plans to get there — balanced,
            run-focused, and station-focused.
          </p>
        </div>
      </section>

      <PacingCalculator />
    </main>
  );
}
