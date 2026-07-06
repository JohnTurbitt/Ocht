"use client";

import { useEffect, useRef, useState } from "react";

type AppLaunchSplashProps = {
  ready: boolean;
  onDone: () => void;
  score?: number;
  tierLabel?: string;
};

// Keep the splash up long enough to register as a deliberate launch screen,
// even when the session resolves instantly.
const MIN_VISIBLE_MS = 1400;
const EXIT_MS = 450;

export function AppLaunchSplash({ ready, onDone, score, tierLabel }: AppLaunchSplashProps) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [exiting, setExiting] = useState(false);
  // Keep the latest onDone without making it an effect dependency, so the
  // dismiss timer is never cancelled by an unrelated parent re-render.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const timer = window.setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || !minElapsed) {
      return;
    }

    setExiting(true);
    const timer = window.setTimeout(() => onDoneRef.current(), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [ready, minElapsed]);

  return (
    <div
      className={exiting ? "app-splash app-splash--exiting" : "app-splash"}
      role="status"
      aria-live="polite"
      aria-label="Loading Ocht"
    >
      <div className="app-splash__logo">
        <span className="app-splash__ring" aria-hidden="true" />
        <span className="app-splash__ring" aria-hidden="true" />
        <span className="app-splash__ring" aria-hidden="true" />
        <svg
          className="app-splash__shield"
          width="72"
          height="88"
          viewBox="0 0 64 78"
          fill="none"
          aria-hidden="true"
        >
          <path
            className="loader-shield-body"
            d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
          />
          <text
            className="loader-shield-glyph"
            x="32"
            y="56"
            textAnchor="middle"
            fontFamily="var(--font-display), sans-serif"
            fontWeight="900"
            fontSize="46"
          >
            8
          </text>
        </svg>
      </div>

      <div className="app-splash__wordmark">
        ocht<em>.</em>
      </div>
      <div className="app-splash__tagline">8 stations · 8 runs · 1 race</div>

      {score !== undefined && tierLabel !== undefined && (
        <div className="app-splash__tier" aria-label={`${tierLabel} score ${score}`}>
          <span className="app-splash__tier-label">{tierLabel.toUpperCase()}</span>
          <span className="app-splash__tier-score">{score}</span>
        </div>
      )}

      <div className="app-splash__dots" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="app-splash__progress" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
