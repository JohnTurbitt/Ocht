import Link from "next/link";

export function LandingFooterCta() {
  return (
    <section className="landing-footer-cta">
      <h2>Your next race starts with your last one.</h2>
      <p>Free to build. No card required.</p>
      <Link className="btn btn--primary btn--lg" href="/app?auth=signup">
        Build my free report
      </Link>
    </section>
  );
}
