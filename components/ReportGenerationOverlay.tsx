import { useEffect, useState } from "react";
import { OctagonSpinner } from "./OctagonSpinner";

type ReportGenerationOverlayProps = {
  // Optional override for the step labels shown beside the ring.
  steps?: string[];
};

const DEFAULT_STEPS = [
  "Parsing splits",
  "Calculating targets",
  "Finding leaks",
  "Scoring strengths",
  "Building report",
];

const SEGMENT_COUNT = 8;
// Eight evenly spaced arcs around the ring — one per station.
const SEGMENT_OFFSETS = Array.from(
  { length: SEGMENT_COUNT },
  (_, index) => -52 * index,
);

export function ReportGenerationOverlay({
  steps = DEFAULT_STEPS,
}: ReportGenerationOverlayProps) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let frame = 0;
    let start: number | null = null;

    function tick(now: number) {
      if (start === null) {
        start = now;
      }

      const elapsed = now - start;
      // Climb briskly to ~92% over the staged hold, then crawl so the bar
      // never visually "finishes" before the parent reveals the report.
      const fast = Math.min(92, (elapsed / 1500) * 92);
      const crawl = Math.min(7, Math.max(0, (elapsed - 1500) / 600));
      frame = window.requestAnimationFrame(tick);
      setPct(Math.min(99, Math.round(fast + crawl)));
    }

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const litSegments = Math.min(
    SEGMENT_COUNT,
    Math.round((pct / 100) * SEGMENT_COUNT),
  );
  const activeStep = Math.min(
    steps.length - 1,
    Math.floor((pct / 100) * steps.length),
  );

  return (
    <div
      className="report-overlay"
      role="status"
      aria-live="polite"
      aria-label="Generating race report"
    >
      <div className="report-overlay__card">
        <div className="report-overlay__ring">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle
              className="report-overlay__track"
              cx="80"
              cy="80"
              r="66"
              strokeWidth="8"
              fill="none"
            />
            {SEGMENT_OFFSETS.map((offset, index) => (
              <circle
                key={offset}
                className={
                  index < litSegments
                    ? "report-overlay__seg report-overlay__seg--lit"
                    : "report-overlay__seg"
                }
                cx="80"
                cy="80"
                r="66"
                strokeWidth="8"
                fill="none"
                strokeDasharray="44 370"
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 80 80)"
              />
            ))}
            <g transform="translate(52 44)">
              <path
                className="loader-shield-body"
                d="M28 2L54 14V40C54 53 28 66 28 66C28 66 2 53 2 40V14L28 2Z"
              />
              <text
                className="loader-shield-glyph"
                x="28"
                y="46"
                textAnchor="middle"
                fontFamily="var(--font-display), sans-serif"
                fontWeight="900"
                fontSize="38"
              >
                8
              </text>
            </g>
          </svg>
        </div>

        <div className="report-overlay__steps">
          {steps.map((label, index) => {
            const state =
              index < activeStep
                ? "done"
                : index === activeStep
                  ? "doing"
                  : "wait";

            return (
              <div
                key={label}
                className={`report-overlay__step report-overlay__step--${state}`}
              >
                <span className="report-overlay__step-icon">
                  {state === "done" ? (
                    <svg
                      className="report-overlay__check"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : state === "doing" ? (
                    <OctagonSpinner size={16} />
                  ) : (
                    "·"
                  )}
                </span>
                <span className="report-overlay__step-text">{label}</span>
              </div>
            );
          })}
        </div>

        <div className="report-overlay__caption">Generating race report…</div>
      </div>
    </div>
  );
}
