"use client";

import { useEffect, useState } from "react";
import { Analysis, formatTime } from "@/lib/analysis";
import { calculateRaceReadiness, readinessLabel } from "@/lib/readiness";
import { CountUp } from "./CountUp";
import { ScoreGauge } from "./ScoreGauge";

type ResultsRevealProps = {
  analysis: Analysis;
  onClose: () => void;
};

export function ResultsReveal({ analysis, onClose }: ResultsRevealProps) {
  const readiness = calculateRaceReadiness(analysis);
  const topLeak = analysis.topLeaks[0];
  const { archetype } = analysis;
  // Start the gauge + bars at 0 and release on mount so they visibly sweep up.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() => setRevealed(true));

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [onClose]);

  return (
    <div
      className="results-reveal"
      role="dialog"
      aria-modal="true"
      aria-label="Race report ready"
    >
      <div className="results-reveal__card">
        <p className="results-reveal__eyebrow">Race report ready</p>

        <div className="results-reveal__finish">
          <span>Projected finish</span>
          <strong>
            <CountUp
              value={analysis.finishSeconds}
              format={formatTime}
              durationMs={1100}
            />
          </strong>
        </div>

        <div className="results-reveal__grid">
          <div className="results-reveal__gauge">
            <ScoreGauge
              score={revealed ? readiness.overall : 0}
              label={readinessLabel(readiness.overall)}
              size={124}
            />
          </div>

          <div className="results-reveal__panels">
            <div className="results-reveal__panel">
              <span>Athlete archetype</span>
              <strong>{archetype.label}</strong>
              <em>{archetype.tagline}</em>
            </div>
            {topLeak ? (
              <div className="results-reveal__panel results-reveal__panel--leak">
                <span>Biggest leak</span>
                <strong>{topLeak.label}</strong>
                <em>{formatTime(topLeak.recoverableSeconds)} realistic gain</em>
              </div>
            ) : null}
          </div>
        </div>

        <button
          className="btn btn--primary btn--cut btn--block btn--lg"
          type="button"
          onClick={onClose}
        >
          View full report
        </button>
      </div>
    </div>
  );
}
