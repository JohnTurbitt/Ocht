import type { Metadata } from "next";
import Link from "next/link";
import { OchtShield } from "@/components/OchtShield";
import { LandingFooterCta } from "@/components/landing/LandingFooterCta";
import { FormatHero } from "@/components/hybrid-racing/FormatHero";
import { FormatQuickFacts } from "@/components/hybrid-racing/FormatQuickFacts";
import { FormatStationGrid } from "@/components/hybrid-racing/FormatStationGrid";
import { getRaceFormatOption } from "@/lib/raceFormats";
import { getTotalRunDistance } from "@/lib/units";
import { trykaStationDescriptions } from "@/lib/formatStationCopy";

const format = getRaceFormatOption("tryka800");
const totalRunKm = getTotalRunDistance(8, "tryka800", "km");

const pageDescription =
  "TRYKA explained: the 800m/500m run format, 8 stations, and how it compares to HYROX. A plain guide for first-time racers.";

export const metadata: Metadata = {
  title: "What Is TRYKA?",
  description: pageDescription,
  alternates: { canonical: "/what-is-tryka" },
  openGraph: {
    type: "article",
    url: "/what-is-tryka",
    title: "What Is TRYKA? - Ocht",
    description: pageDescription,
    images: [
      {
        url: "/hybrid-racing/tryka-hero.jpg",
        width: 1200,
        height: 630,
        alt: "Hybrid-race event floor with rowing ergs set up in rows",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "What Is TRYKA? - Ocht",
    description: pageDescription,
    images: ["/hybrid-racing/tryka-hero.jpg"],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "What Is TRYKA?",
  description: pageDescription,
  publisher: {
    "@type": "Organization",
    name: "Ocht",
  },
};

export default function WhatIsTrykaPage() {
  return (
    <main className="format-page">
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

      <FormatHero
        eyebrow="Race format guide"
        title="What is TRYKA?"
        dek="Shorter run legs, 8 stations, the same run-station-run structure as HYROX. Here's what sets a TRYKA race apart."
        photoSrc="/hybrid-racing/tryka-hero.jpg"
        photoAlt="Rows of rowing ergometers set up on a hybrid-race event floor"
        ctaHref="/app?auth=signup"
        ctaLabel="Build my free TRYKA report"
      />

      <FormatQuickFacts
        facts={[
          { value: `${totalRunKm}km`, label: "Total running (800 distance)" },
          { value: `${format.stations.length}`, label: "Stations" },
          { value: "500/800", label: "Distance options" },
        ]}
      />

      <section className="format-body">
        <h2>How a TRYKA race works</h2>
        <p>
          TRYKA follows the same basic shape as HYROX — 8 runs alternating
          with 8 functional-fitness stations, timing chip running
          continuously through the transitions — but shortens the run legs.
          TRYKA races come in two distances: TRYKA 800, with 8 runs of 800m
          each, and TRYKA 500, with 8 runs of 500m each. Total running comes
          to {getTotalRunDistance(8, "tryka800", "km")}km or{" "}
          {getTotalRunDistance(8, "tryka500", "km")}km depending on which
          distance you enter, against HYROX&apos;s 8km.
        </p>
        <p>
          The station lineup is also different from HYROX — TRYKA reorders
          and relabels several of the movements (a longer SkiErg opener,
          rowing and sled work later in the race) rather than reusing
          HYROX&apos;s exact station order. TRYKA events currently run in
          Ireland, the UK, and Portugal, including RDS Dublin, London, and
          Lisbon.
        </p>
      </section>

      <FormatStationGrid
        heading={`The ${format.stations.length} TRYKA stations (800 distance)`}
        stations={format.stations.map((station) => ({
          label: station.label,
          description: trykaStationDescriptions[station.key] ?? station.guidance,
        }))}
      />

      <section className="format-body format-body--callout">
        <h2>TRYKA vs HYROX</h2>
        <p>
          Ocht also supports <Link href="/what-is-hyrox">HYROX</Link>, the
          longer-running, more established hybrid-race format. If
          you&apos;re deciding which to try first, TRYKA&apos;s shorter run
          legs put relatively more weight on the stations and transitions;
          HYROX&apos;s full 1km legs put more weight on sustained running
          pace. See the HYROX guide for the full comparison.
        </p>
      </section>

      <section className="format-body">
        <h2>Who TRYKA is for</h2>
        <p>
          TRYKA&apos;s shorter run legs make it a reasonable first hybrid
          race for athletes coming from a strength or CrossFit-style
          background rather than a running background, since less of the
          race is spent on sustained aerobic running. It&apos;s also a good
          fit if you&apos;ve already done HYROX and want to see how a
          different run-to-station ratio changes your pacing decisions.
        </p>
      </section>

      <section className="format-body">
        <h2>Training for TRYKA</h2>
        <p>
          Because the run legs are shorter, transitions make up a larger
          share of total race time than in HYROX — practising fast entries
          and exits at each station matters more here, not less. Interval
          work at race-leg distance (500m or 800m repeats) paired with the
          specific TRYKA station movements, done back-to-back rather than in
          isolation, is the closest training analogue to what the race
          actually demands.
        </p>
      </section>

      <section className="format-body">
        <h2>Frequently asked questions</h2>
        <h3>What&apos;s the difference between TRYKA 500 and TRYKA 800?</h3>
        <p>
          The run leg distance — 500m or 800m per leg, 8 legs total either
          way. Everything else about the format stays the same.
        </p>
        <h3>Is TRYKA easier than HYROX?</h3>
        <p>
          Not necessarily easier — just different. Less total running means
          more of the race is decided at the stations and in transitions.
        </p>
        <h3>Where are TRYKA races held?</h3>
        <p>
          Current events include RDS Dublin (Ireland), London (UK), and
          Lisbon (Portugal).
        </p>
      </section>

      <LandingFooterCta />
    </main>
  );
}
