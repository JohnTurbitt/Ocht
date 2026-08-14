import Link from "next/link";
import { OchtShield } from "@/components/OchtShield";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingFeatureHighlight } from "@/components/landing/LandingFeatureHighlight";
import { LandingFooterCta } from "@/components/landing/LandingFooterCta";

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Ocht",
  applicationCategory: "SportsApplication",
  operatingSystem: "Web",
  description:
    "Trace hybrid race splits, find time leaks and build a realistic next target.",
};

export default function LandingPage() {
  return (
    <main className="landing-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd),
        }}
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
          <Link href="/app?auth=login">Log in</Link>
          <Link className="btn btn--primary btn--sm" href="/app?auth=signup">
            Sign up free
          </Link>
        </nav>
      </header>

      <LandingHero />
      <LandingHowItWorks />
      <LandingFeatureHighlight />
      <LandingFooterCta />
    </main>
  );
}
