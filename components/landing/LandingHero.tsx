import Link from "next/link";

export function LandingHero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero__text">
        <p className="landing-hero__eyebrow">Race report engine</p>
        <h1>
          Know exactly where
          <br />
          your race was won.
        </h1>
        <p className="landing-hero__lead">
          Enter your splits and station times. Ocht turns them into a
          race-day breakdown of leaks, pacing and where you actually lost
          the most time.
        </p>
        <div className="landing-hero__actions">
          <Link
            className="btn btn--primary btn--cut btn--lg"
            href="/app?auth=signup"
          >
            Build my free report
          </Link>
          <Link className="btn btn--secondary btn--lg" href="/app?sample=1">
            See a sample report
          </Link>
        </div>
      </div>
      <div
        className="landing-hero__photo"
        role="img"
        aria-label="Two athletes carrying sandbags during a HYROX race"
      />
    </section>
  );
}
