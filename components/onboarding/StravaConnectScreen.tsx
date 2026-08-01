"use client";

interface Props {
  goal: "results" | "training";
  onSkip: () => void;
}

const BENEFITS = [
  { title: "Training automatically filled in", desc: "We calculate your mileage, long run and intensity from your Strava history" },
  { title: "Running limiter diagnosis", desc: "Ocht explains whether your aerobic base, hard sessions or recovery is holding you back" },
  { title: "Fade risk warning", desc: "We spot if your training suggests you'll slow in the second half of the race" },
  { title: "Fitness insights (premium)", desc: "Lactate threshold, training load and pace zones calculated from your data" },
];

export function StravaConnectScreen({ goal, onSkip }: Props) {
  return (
    <div>
      <div className="onboarding-strava__lockup">
        <span className="onboarding-strava__brand">Ocht</span>
        <span className="onboarding-strava__sep">✕</span>
        <svg width="104" height="26" viewBox="0 0 200 50" fill="none">
          <path d="M20 25L12 9L4 25h7.5l1-2.2 1 2.2H20z" fill="#FC5200" />
          <path d="M27 25l-6-13-6 13h7l1-2.2 1 2.2h3z" fill="#FC5200" opacity="0.55" />
          <text x="36" y="36" fontFamily="system-ui" fontWeight="800" fontSize="30" fill="#FC5200">Strava</text>
        </svg>
      </div>
      <div className="onboarding-modal__title" style={{ textAlign: "center" }}>Make your reports personal</div>
      <div className="onboarding-modal__subtitle" style={{ textAlign: "center", marginBottom: 16 }}>
        Ocht uses your Strava data to personalise every report
      </div>
      <div className="onboarding-strava__benefits">
        {BENEFITS.map((b) => (
          <div key={b.title} className="onboarding-strava__benefit">
            <div className="onboarding-strava__dot" />
            <div>
              <div className="onboarding-strava__benefit-title">{b.title}</div>
              <div className="onboarding-strava__benefit-desc">{b.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <a href="/api/strava/connect" className="onboarding-strava__connect-btn" onClick={() => localStorage.setItem("ocht.onboardingCompleted", "true")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        Connect with Strava
      </a>
      <button className="onboarding-strava__skip-btn" onClick={onSkip}>
        {goal === "results" ? "Skip — I'll enter training details manually" : "Skip — enter details manually"}
      </button>
    </div>
  );
}
