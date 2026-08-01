const steps = [
  {
    number: "01",
    title: "Log your splits",
    body: "Run times, station times, and your official finish if you've got it.",
  },
  {
    number: "02",
    title: "Ocht does the math",
    body: "Pacing, roxzone tax and an athlete archetype, calculated rather than guessed.",
  },
  {
    number: "03",
    title: "See where you lost time",
    body: "A ranked list of leaks so next race, you train the right thing.",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="landing-section landing-how">
      <p className="landing-section__kicker">How it works</p>
      <h2>Three steps, one honest report</h2>
      <div className="landing-how__steps">
        {steps.map((step) => (
          <article className="landing-how__step" key={step.number}>
            <span className="landing-how__number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
