"use client";

type Goal = "results" | "training" | "explore";

interface Props {
  onSelect: (goal: Goal) => void;
}

export function GoalScreen({ onSelect }: Props) {
  return (
    <div>
      <div className="onboarding-modal__title">Welcome to Ocht</div>
      <div className="onboarding-modal__subtitle">Pick the path that fits you</div>
      <div className="onboarding-goal-list" style={{ marginTop: 16 }}>
        <button className="onboarding-goal-item" onClick={() => onSelect("results")}>
          <svg className="onboarding-goal-item__icon" viewBox="0 0 40 40" fill="none">
            <line x1="6" y1="34" x2="34" y2="34" stroke="currentColor" strokeWidth="1.5" />
            <rect x="8" y="20" width="6" height="14" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.13" />
            <rect x="17" y="12" width="6" height="22" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.27" />
            <rect x="26" y="16" width="6" height="18" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.13" />
            <line x1="17" y1="6" x2="17" y2="12" stroke="currentColor" strokeWidth="1.5" />
            <polyline points="17,6 26,8 17,10" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.27" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="onboarding-goal-item__label">I&apos;ve done a race or training sim</div>
            <div className="onboarding-goal-item__desc">Enter your splits and get a full breakdown of where you lost time</div>
          </div>
          <span className="onboarding-goal-item__arrow">›</span>
        </button>

        <button className="onboarding-goal-item" onClick={() => onSelect("training")}>
          <svg className="onboarding-goal-item__icon" viewBox="0 0 40 40" fill="none">
            <polyline points="8,30 16,22 22,26 32,10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
            <circle cx="8" cy="30" r="2.5" fill="currentColor" fillOpacity="0.6" />
            <circle cx="16" cy="22" r="2.5" fill="currentColor" fillOpacity="0.6" />
            <circle cx="22" cy="26" r="2.5" fill="currentColor" fillOpacity="0.6" />
            <circle cx="32" cy="10" r="2.5" fill="currentColor" />
            <polyline points="27,6 32,10 28,15" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="onboarding-goal-item__label">I&apos;m training for my first Hyrox</div>
            <div className="onboarding-goal-item__desc">Connect Strava and we&apos;ll predict what time you could realistically target</div>
          </div>
          <span className="onboarding-goal-item__arrow">›</span>
        </button>

        <button className="onboarding-goal-item" onClick={() => onSelect("explore")}>
          <svg className="onboarding-goal-item__icon" viewBox="0 0 40 40" fill="none">
            <polyline points="3,20 9,20 12,10 16,30 20,14 24,26 28,20 37,20" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div>
            <div className="onboarding-goal-item__label">Just having a look</div>
            <div className="onboarding-goal-item__desc">Explore with a sample report — no data needed</div>
          </div>
          <span className="onboarding-goal-item__arrow">›</span>
        </button>
      </div>
    </div>
  );
}
