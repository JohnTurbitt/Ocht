import type { Metadata } from "next";
import Link from "next/link";
import { OchtShield } from "@/components/OchtShield";
import { LandingFooterCta } from "@/components/landing/LandingFooterCta";
import { FormatHero } from "@/components/hybrid-racing/FormatHero";
import { FormatQuickFacts } from "@/components/hybrid-racing/FormatQuickFacts";
import { FormatStationGrid } from "@/components/hybrid-racing/FormatStationGrid";
import { getRaceFormatOption } from "@/lib/raceFormats";
import { getTotalRunDistance } from "@/lib/units";

const format = getRaceFormatOption("hyrox");
const totalRunKm = getTotalRunDistance(8, "hyrox", "km");

const pageDescription =
  "HYROX explained: the 8km run, 8-station format, fixed station order, and how it compares to TRYKA. A plain guide for first-time racers.";

export const metadata: Metadata = {
  title: "What Is HYROX?",
  description: pageDescription,
  alternates: { canonical: "/what-is-hyrox" },
  openGraph: {
    type: "article",
    url: "/what-is-hyrox",
    title: "What Is HYROX? - Ocht",
    description: pageDescription,
    images: [
      {
        url: "/hybrid-racing/hyrox-hero.jpg",
        width: 1200,
        height: 630,
        alt: "Competitor walking through a HYROX race floor",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "What Is HYROX? - Ocht",
    description: pageDescription,
    images: ["/hybrid-racing/hyrox-hero.jpg"],
  },
};

const stationDescriptions: Record<string, string> = {
  ski: "1,000m on the SkiErg to open the race — the first check on pacing discipline.",
  sledPush: "50m sled push at heavy load. Short, brutal, over quickly.",
  sledPull: "50m sled pull, hand over hand on a rope.",
  burpees: "80m of burpee broad jumps — the station most people dread.",
  row: "1,000m on the rowing ergometer.",
  farmers: "200m farmers carry with two loaded kettlebells.",
  lunges: "100m of walking lunges carrying a sandbag.",
  wallBalls: "The final station — repeated wall ball shots before the finish line.",
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "What Is HYROX?",
  description: pageDescription,
  publisher: {
    "@type": "Organization",
    name: "Ocht",
  },
};

export default function WhatIsHyroxPage() {
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
        <nav className="landing-header__actions" aria-label="Account">
          <Link href="/app?auth=login">Log in</Link>
          <Link className="btn btn--primary btn--sm" href="/app?auth=signup">
            Sign up free
          </Link>
        </nav>
      </header>

      <FormatHero
        eyebrow="Race format guide"
        title="What is HYROX?"
        dek="8km of running, 8 functional stations, one fixed order, the same course worldwide. Here's what a HYROX race actually involves."
        photoSrc="/hybrid-racing/hyrox-hero.jpg"
        photoAlt="Competitor walking through a HYROX race floor with 'Last reps!' screens overhead"
        ctaHref="/app?auth=signup"
        ctaLabel="Build my free HYROX report"
      />

      <FormatQuickFacts
        facts={[
          { value: `${totalRunKm}km`, label: "Total running" },
          { value: "8", label: "Stations" },
          { value: "Fixed", label: "Station order" },
        ]}
      />

      <section className="format-body">
        <h2>How a HYROX race works</h2>
        <p>
          HYROX bills itself as the World Series of Fitness Racing, and the
          format is built to make that claim testable: every event, in every
          city, runs the exact same course. A HYROX race alternates 8
          one-kilometre runs with 8 functional-fitness stations, always in the
          same order — run, station, run, station — until the wall ball
          station closes the race out. There&apos;s no course variation to argue
          about between venues, which is why times are directly comparable
          from one HYROX to the next.
        </p>
        <p>
          Racers move through the roxzone — the section of the floor where
          the stations sit — carrying their own timing chip, so the clock
          never stops between a run leg and a station. That transition time
          is part of the race, not a break from it, which is a big part of
          why pacing the runs correctly matters as much as station strength.
        </p>
      </section>

      <FormatStationGrid
        heading="The 8 HYROX stations"
        stations={format.stations.map((station) => ({
          label: station.label,
          description: stationDescriptions[station.key] ?? station.guidance,
        }))}
      />

      <section className="format-body format-body--callout">
        <h2>HYROX vs TRYKA</h2>
        <p>
          Ocht also supports <Link href="/what-is-tryka">TRYKA</Link>, a
          newer hybrid-race series with shorter run legs (500m or 800m
          instead of 1km) and a different station lineup. The two formats
          reward slightly different athletes — see the TRYKA guide for how
          it compares.
        </p>
      </section>

      <section className="format-body">
        <h2>Who HYROX is for</h2>
        <p>
          HYROX races across an Open, Pro, and Doubles/Relay structure, so
          the same event floor holds first-timers and competitive athletes
          at once. Most people finish comfortably inside the cutoffs without
          being elite runners or elite lifters — the format rewards being
          reasonably competent at both over being exceptional at either. If
          you can run 8km total at a controlled pace and handle moderate
          loads under fatigue, you can finish one.
        </p>
      </section>

      <section className="format-body">
        <h2>Training for HYROX</h2>
        <p>
          The two most common limiters aren&apos;t raw fitness — they&apos;re pacing
          the runs too aggressively early, and losing time in the
          transitions into and out of stations. Training that blends
          continuous running with station-specific strength-endurance work,
          practised in the same alternating pattern as race day, tends to
          transfer better than pure running or pure strength training done
          separately. Ocht&apos;s report breaks your splits down station by
          station and run by run, so you can see exactly which one is
          costing you the most time.
        </p>
      </section>

      <section className="format-body">
        <h2>Frequently asked questions</h2>
        <h3>How long does a HYROX race take?</h3>
        <p>
          It varies hugely by division and fitness level — the format is
          built to be finishable by a wide range of athletes, not just
          elite competitors.
        </p>
        <h3>Do I need to be a strong runner to do HYROX?</h3>
        <p>
          No. Running fitness matters, but so does station strength and
          transition speed — HYROX rewards being well-rounded over being
          fast in one discipline.
        </p>
        <h3>Is HYROX the same at every event?</h3>
        <p>
          Yes — the run distance, station order, and station format are
          fixed worldwide, which is what makes times comparable between
          venues.
        </p>
      </section>

      <LandingFooterCta />
    </main>
  );
}
