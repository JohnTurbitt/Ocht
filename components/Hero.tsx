import { OchtShield } from "./OchtShield";

type HeroProps = {
  showBeginnerGuide: boolean;
  showHints: boolean;
  onAnalyse: () => void;
  onLoadSample: () => void;
  onShowDemo: () => void;
  onDismissGuide: () => void;
  onShowHintsChange: (checked: boolean) => void;
};

export function Hero({
  showBeginnerGuide,
  showHints,
  onAnalyse,
  onLoadSample,
  onShowDemo,
  onDismissGuide,
  onShowHintsChange,
}: HeroProps) {
  return (
    <section className="intro hero">
      <div className="hero__copy">
        <p className="hero__eyebrow">Hybrid race intelligence</p>
        <h1>Find the time leaks between your reps and runs.</h1>
        <p className="hero__lead">
          Add the times from your race or training simulation and Ocht shows
          where you lost time, what is already strong and what target looks
          realistic next.
        </p>
        <div className="hero__actions">
          <button
            className="btn btn--primary btn--cut btn--lg"
            type="button"
            onClick={onAnalyse}
          >
            Analyse a race
          </button>
          <button
            className="btn btn--secondary btn--lg"
            type="button"
            onClick={onLoadSample}
          >
            Load sample race
          </button>
        </div>
        <ul className="hero__trust" aria-label="What you get">
          <li>Deterministic formulas</li>
          <li>Coach-friendly exports</li>
          <li>Free core report</li>
        </ul>
        {showBeginnerGuide ? (
          <div className="intro-guide" aria-label="How Ocht helps">
            <div>
              <strong>New to hybrid racing?</strong>
              <span>
                Use Load sample race first, then replace the example times with
                your own run and station splits.
              </span>
            </div>
            <div className="intro-guide__actions">
              <button
                className="btn btn--secondary btn--sm"
                type="button"
                onClick={onShowDemo}
              >
                Show quick demo
              </button>
              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={onDismissGuide}
              >
                Do not show again
              </button>
            </div>
          </div>
        ) : null}
        <label className="hint-toggle">
          <input
            checked={showHints}
            onChange={(event) => onShowHintsChange(event.target.checked)}
            type="checkbox"
          />
          <span>Show beginner hints</span>
        </label>
      </div>
      <aside className="hero__motif" aria-hidden="true">
        <div className="hero__ring">
          <svg className="hero__octo" viewBox="0 0 110 110" fill="none">
            <polygon
              className="hero__octo-line"
              points="55,5 90,18 105,55 90,92 55,105 20,92 5,55 20,18"
            />
            <g className="hero__octo-dots">
              <circle cx="55" cy="5" r="3" />
              <circle cx="90" cy="18" r="3" />
              <circle cx="105" cy="55" r="3" />
              <circle cx="90" cy="92" r="3" />
              <circle cx="55" cy="105" r="3" />
              <circle cx="20" cy="92" r="3" />
              <circle cx="5" cy="55" r="3" />
              <circle cx="20" cy="18" r="3" />
            </g>
          </svg>
          <OchtShield className="hero__shield" size={68} />
        </div>
        <p className="hero__identity">8 stations · 8 runs · 1 race</p>
      </aside>
    </section>
  );
}
