import Link from "next/link";

const differentiators = [
  "Roxzone tax — how much the transitions actually cost you",
  "Athlete archetype — Runner, Powerhouse, Fader, and more",
  "Ranked time leaks — the one thing to fix before your next race",
];

export function LandingFeatureHighlight() {
  return (
    <section className="landing-section landing-feature">
      <div className="landing-feature__copy">
        <h2>This isn&apos;t a finish-time calculator.</h2>
        <p>
          Most race apps stop at &quot;here&apos;s your time.&quot; Ocht
          tells you why.
        </p>
        <ul className="landing-feature__list">
          {differentiators.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <Link className="btn btn--primary" href="/app?sample=1">
          Try it with sample data
        </Link>
      </div>
      <div className="landing-feature__preview" aria-hidden="true">
        <div className="landing-feature__preview-head">
          <span>Race readiness</span>
          <span className="landing-feature__badge">Powerhouse</span>
        </div>
        <div className="landing-feature__score">
          <span className="landing-feature__score-number">78</span>
          <span className="landing-feature__score-label">/ 100 overall</span>
        </div>
        <div className="landing-feature__row">
          <span>Roxzone transitions</span>
          <span className="landing-feature__leak">+2:14 leak</span>
        </div>
        <div className="landing-feature__row">
          <span>Run pacing</span>
          <span className="landing-feature__strong">Strong</span>
        </div>
        <div className="landing-feature__row">
          <span>Station 4 — Sled push</span>
          <span className="landing-feature__leak">+0:41 leak</span>
        </div>
      </div>
    </section>
  );
}
