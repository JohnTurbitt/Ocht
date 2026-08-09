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
        <img
          className="onboarding-strava__mark"
          src="/brand/strava/api_logo_cptblWith_strava_horiz_white.svg"
          alt="Compatible with Strava"
        />
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
        <img src="/brand/strava/btn_strava_connect_with_orange.svg" alt="Connect with Strava" />
      </a>
      <button className="onboarding-strava__skip-btn" onClick={onSkip}>
        {goal === "results" ? "Skip. I'll enter training details manually" : "Skip. Enter details manually"}
      </button>
    </div>
  );
}
