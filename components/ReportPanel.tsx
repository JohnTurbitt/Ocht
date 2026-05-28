import { useEffect, useRef, useState, type RefObject } from "react";
import { toBlob } from "html-to-image";
import { Analysis, formatTime } from "@/lib/analysis";
import { trackEvent } from "@/lib/analytics";
import { calculateRaceReadiness, readinessLabel } from "@/lib/readiness";
import { buildReportExportText } from "@/lib/reportExport";
import {
  DistanceUnit,
  distanceUnitLabels,
  formatPaceForUnit,
  formatSpeedForUnit,
  secondsPerDistanceUnit,
} from "@/lib/units";
import { CalculationExplainer } from "./CalculationExplainer";
import { Hint } from "./Hint";
import { PremiumBadge } from "./PremiumBadge";
import {
  PremiumReportPoster,
  RaceFlowMap,
  RaceStory,
  TimeLeakHeatmap,
} from "./RaceVisuals";
import { TargetSimulator } from "./TargetSimulator";

type ReportPanelProps = {
  analysis: Analysis;
  distanceUnit: DistanceUnit;
  hasGeneratedReport: boolean;
  fullReportUnlocked: boolean;
  canStartCheckout: boolean;
  billingLoading: boolean;
  showHints: boolean;
  runGainPerKm: string;
  stationGain: string;
  transitionGain: string;
  onStartCheckout: () => void;
  onRunGainPerKmChange: (value: string) => void;
  onStationGainChange: (value: string) => void;
  onTransitionGainChange: (value: string) => void;
};

type ReportSectionProps = {
  title: string;
  defaultOpen?: boolean;
  premium?: boolean;
  children: React.ReactNode;
};

function ReportSection({
  title,
  defaultOpen = false,
  premium = false,
  children,
}: ReportSectionProps) {
  return (
    <details className="report-section" open={defaultOpen}>
      <summary>
        <span>
          {title} {premium ? <PremiumBadge /> : null}
        </span>
        <strong>View</strong>
      </summary>
      <div className="report-section__body">{children}</div>
    </details>
  );
}

function describeGoodGap(gapSeconds: number) {
  if (gapSeconds <= 0) {
    return "Ahead of benchmark";
  }

  if (gapSeconds <= 10) {
    return "Near benchmark";
  }

  return "Closest benchmark match";
}

function ReadinessMetric({
  label,
  score,
  detail,
}: {
  label: string;
  score: number;
  detail: string;
}) {
  return (
    <span>
      {label}
      <strong>
        {score}
        <small>/100</small>
      </strong>
      <em>{detail}</em>
    </span>
  );
}

export function ReportPanel({
  analysis,
  distanceUnit,
  hasGeneratedReport,
  fullReportUnlocked,
  canStartCheckout,
  billingLoading,
  showHints,
  runGainPerKm,
  stationGain,
  transitionGain,
  onStartCheckout,
  onRunGainPerKmChange,
  onStationGainChange,
  onTransitionGainChange,
}: ReportPanelProps) {
  const reportCaptureRef = useRef<HTMLElement>(null);
  const jumpNavShellRef = useRef<HTMLDivElement>(null);
  const sharePosterCaptureRef = useRef<HTMLDivElement>(null);
  const [generatedDate, setGeneratedDate] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [jumpNavFloating, setJumpNavFloating] = useState(false);
  const [jumpNavTop, setJumpNavTop] = useState(92);
  const visibleLeaks = fullReportUnlocked
    ? analysis.topLeaks
    : analysis.topLeaks.slice(0, 2);
  const primaryLeak = analysis.topLeaks[0];
  const bestSegment = [...analysis.raceSegments].sort(
    (a, b) => a.leakSeconds - b.leakSeconds,
  )[0];
  const bestStation = [...analysis.stationResults].sort((a, b) => a.gap - b.gap)[0];
  const strongSegments = analysis.raceSegments.filter(
    (segment) => segment.status === "strong",
  );
  const readiness = calculateRaceReadiness(analysis);

  const exportText = buildReportExportText(analysis, generatedDate, distanceUnit);
  const averageRunPace = formatPaceForUnit(
    analysis.averageRunSeconds,
    analysis.raceFormat,
    distanceUnit,
  );
  const averageRunSpeed = formatSpeedForUnit(
    analysis.averageRunSeconds,
    analysis.raceFormat,
    distanceUnit,
  );
  const runFadePace = secondsPerDistanceUnit(
    analysis.runFadeSeconds,
    analysis.raceFormat,
    distanceUnit,
  );
  const timeToFind =
    analysis.targetGapSeconds > 0
      ? formatTime(analysis.targetGapSeconds)
      : "On target";
  const nextAction = primaryLeak
    ? `${primaryLeak.label}: ${primaryLeak.recommendation}`
    : "Generate a complete report to identify the highest-value training focus.";
  const bestSplitDetail = bestSegment
    ? `${formatTime(bestSegment.actualSeconds)} actual / ${formatTime(bestSegment.targetSeconds)} target`
    : "Add splits to identify your most controlled segment.";
  const biggestLeakDetail = primaryLeak
    ? `${formatTime(primaryLeak.leakSeconds)} leak / ${formatTime(primaryLeak.recoverableSeconds)} realistic gain`
    : "Add splits to identify the highest-value leak.";

  function scrollToRaceFlow() {
    scrollToReportSection("race-flow-map");
  }

  function scrollToReportSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    setGeneratedDate(new Date().toLocaleDateString());
  }, []);

  useEffect(() => {
    if (!shareModalOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShareModalOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [shareModalOpen]);

  useEffect(() => {
    function updateJumpNavPosition() {
      const report = reportCaptureRef.current;
      const shell = jumpNavShellRef.current;

      if (!report || !shell) {
        setJumpNavFloating(false);
        return;
      }

      const header = document.querySelector<HTMLElement>(".site-header");
      const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
      const topOffset = Math.max(12, Math.round(headerBottom + 10));
      const shellBounds = shell.getBoundingClientRect();
      const reportBounds = report.getBoundingClientRect();

      setJumpNavTop(topOffset);
      setJumpNavFloating(
        shellBounds.top <= topOffset && reportBounds.bottom >= topOffset + 80,
      );
    }

    updateJumpNavPosition();
    window.addEventListener("scroll", updateJumpNavPosition, { passive: true });
    window.addEventListener("resize", updateJumpNavPosition);

    return () => {
      window.removeEventListener("scroll", updateJumpNavPosition);
      window.removeEventListener("resize", updateJumpNavPosition);
    };
  }, []);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(exportText);
      setExportMessage("Report copied.");
      setShareModalOpen(false);
      trackEvent("report_exported", {
        format: "text_clipboard",
      });
    } catch {
      setExportMessage("Copy was blocked by the browser.");
    }
  }

  async function shareReport() {
    try {
      const captureBackground =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--panel")
          .trim() || "#ffffff";
      const reportBlob = reportCaptureRef.current
        ? await toBlob(reportCaptureRef.current, {
            backgroundColor: captureBackground,
            cacheBust: true,
            filter: (node) => {
              if (!(node instanceof HTMLElement)) {
                return true;
              }

              return !(
                node.classList.contains("report-actions") ||
                node.classList.contains("report__print") ||
                node.classList.contains("share-preview-modal")
              );
            },
            pixelRatio: 2,
          })
        : null;

      if (reportBlob && navigator.share) {
        const reportFile = new File([reportBlob], "ocht-race-report.png", {
          type: "image/png",
        });
        const shareData = {
          files: [reportFile],
          text: "Ocht race report",
          title: "Ocht Race Report",
        };

        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setExportMessage("Report image shared.");
          setShareModalOpen(false);
          trackEvent("report_exported", {
            format: "full_image_share",
          });
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: "Ocht Race Report",
          text: exportText,
        });
        setExportMessage("Share sheet opened.");
        setShareModalOpen(false);
        trackEvent("report_exported", {
          format: "text_share",
        });
        return;
      }

      await copyReport();
    } catch {
      setExportMessage("Share was cancelled or blocked.");
    }
  }

  async function createPosterBlob(
    targetRef: RefObject<HTMLDivElement | null> = sharePosterCaptureRef,
  ) {
    if (!targetRef.current) {
      return null;
    }

    return toBlob(targetRef.current, {
      backgroundColor: "transparent",
      cacheBust: true,
      pixelRatio: 3,
    });
  }

  async function copyPosterImage(
    targetRef: RefObject<HTMLDivElement | null> = sharePosterCaptureRef,
  ) {
    try {
      const posterBlob = await createPosterBlob(targetRef);

      if (!posterBlob) {
        setExportMessage("Poster was not ready to copy.");
        return;
      }

      if ("ClipboardItem" in window && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ [posterBlob.type]: posterBlob }),
        ]);
        setExportMessage("Poster image copied.");
        setShareModalOpen(false);
        trackEvent("report_exported", {
          format: "poster_clipboard",
        });
        return;
      }

      setExportMessage("Image clipboard is not supported in this browser.");
    } catch {
      setExportMessage("Poster copy was blocked by the browser.");
    }
  }

  async function sharePosterImage(
    targetRef: RefObject<HTMLDivElement | null> = sharePosterCaptureRef,
  ) {
    try {
      const posterBlob = await createPosterBlob(targetRef);

      if (!posterBlob) {
        setExportMessage("Poster was not ready to share.");
        return;
      }

      const posterFile = new File([posterBlob], "ocht-story-poster.png", {
        type: "image/png",
      });
      const shareData = {
        files: [posterFile],
        text: "Ocht race poster",
        title: "Ocht Race Poster",
      };

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        setExportMessage("Poster shared.");
        setShareModalOpen(false);
        trackEvent("report_exported", {
          format: "poster_share",
        });
        return;
      }

      await copyPosterImage(targetRef);
    } catch {
      setExportMessage("Poster share was cancelled or blocked.");
    }
  }

  function downloadReport() {
    try {
      const reportBlob = new Blob([exportText], { type: "text/plain" });
      const reportUrl = URL.createObjectURL(reportBlob);
      const reportLink = document.createElement("a");

      reportLink.href = reportUrl;
      reportLink.download = "ocht-race-report.txt";
      reportLink.click();
      URL.revokeObjectURL(reportUrl);
      setExportMessage("Report downloaded.");
      setShareModalOpen(false);
      trackEvent("report_exported", {
        format: "text_download",
      });
    } catch {
      setExportMessage("Download was blocked by the browser.");
    }
  }

  return (
    <aside className="report" aria-live="polite" ref={reportCaptureRef}>
      <div className="report__header">
        <div className="section-heading">
          <p className="eyebrow">Math Engine</p>
          <h2>{hasGeneratedReport ? "Your race breakdown" : "Live preview"}</h2>
        </div>
        <div className="report-actions report-actions--header">
          {fullReportUnlocked ? (
            <button
              className="share-trigger"
              type="button"
              onClick={() => {
                setShareModalOpen(true);
                trackEvent("share_options_opened");
              }}
              aria-label="Open share options"
              title="Share and export"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                <path d="M12 16V4" />
                <path d="M7 9l5-5 5 5" />
              </svg>
              <PremiumBadge />
            </button>
          ) : null}
          <button
            className="report__print"
            type="button"
            onClick={() => {
              trackEvent("report_exported", {
                format: "print",
              });
              window.print();
            }}
            disabled={!fullReportUnlocked}
          >
            Print report
          </button>
        </div>
      </div>
      <p className="report__date">
        {generatedDate ? `Generated ${generatedDate} - Ocht` : "Ocht"}
      </p>
      <section id="report-overview" className="race-cockpit" aria-label="Race overview">
        <div className="race-cockpit__hero">
          <span>{hasGeneratedReport ? "Race cockpit" : "Live cockpit"}</span>
          <strong>{formatTime(analysis.finishSeconds)}</strong>
          <p>{analysis.targetPlanSummary}</p>
        </div>
        <div className="race-cockpit__stats">
          <div className="race-cockpit__stat">
            <span>Time to find</span>
            <strong>{timeToFind}</strong>
            <small>against your entered target</small>
          </div>
          <div className="race-cockpit__stat">
            <span>Realistic gain</span>
            <strong>{formatTime(analysis.recoverableSeconds)}</strong>
            <small>from the top ranked leaks</small>
          </div>
          <button
            className="race-cockpit__stat race-cockpit__stat--button"
            type="button"
            onClick={scrollToRaceFlow}
          >
            <span>Biggest leak</span>
            <strong>{primaryLeak?.label ?? "Not clear"}</strong>
            <small>{biggestLeakDetail}</small>
          </button>
          <button
            className="race-cockpit__stat race-cockpit__stat--button"
            type="button"
            onClick={scrollToRaceFlow}
          >
            <span>Most controlled split</span>
            <strong>{bestSegment?.label ?? "Not clear"}</strong>
            <small>{bestSplitDetail}</small>
          </button>
        </div>
        <div className="race-cockpit__action">
          <span>Next action</span>
          <p>{nextAction}</p>
        </div>
        <div className="race-cockpit__meta">
          <span>{analysis.levelLabel}</span>
          <span>{analysis.targetDifficultyLabel}</span>
          <span>{averageRunPace} avg run</span>
        </div>
      </section>

      <div className="report-jump-nav-shell" ref={jumpNavShellRef}>
        <nav
          className={
            jumpNavFloating
              ? "report-jump-nav report-jump-nav--floating"
              : "report-jump-nav"
          }
          style={jumpNavFloating ? { top: `${jumpNavTop}px` } : undefined}
          aria-label="Report sections"
        >
          <button type="button" onClick={() => scrollToReportSection("report-overview")}>
            Overview
          </button>
          <button type="button" onClick={() => scrollToReportSection("race-flow-map")}>
            Flow
          </button>
          <button type="button" onClick={() => scrollToReportSection("report-target-path")}>
            Target
          </button>
          <button type="button" onClick={() => scrollToReportSection("report-readiness")}>
            Readiness
          </button>
          <button type="button" onClick={() => scrollToReportSection("report-strengths")}>
            Strengths
          </button>
          <button type="button" onClick={() => scrollToReportSection("report-leaks")}>
            Leaks
          </button>
          <button type="button" onClick={() => scrollToReportSection("report-training")}>
            Training
          </button>
          <button
            type="button"
            onClick={() =>
              fullReportUnlocked
                ? (setShareModalOpen(true), trackEvent("share_options_opened"))
                : scrollToReportSection("report-training")
            }
          >
            {fullReportUnlocked ? "Share" : "Upgrade"}
          </button>
        </nav>
      </div>

      <div id="race-flow-map" className="report-scroll-anchor">
        <ReportSection title="Race flow map" defaultOpen>
          <RaceFlowMap analysis={analysis} distanceUnit={distanceUnit} />
        </ReportSection>
      </div>

      <div className="metric-row metric-row--three">
        <div>
          <span>Average run pace</span>
          <strong>{averageRunPace}</strong>
          <small>{averageRunSpeed}</small>
        </div>
        <div>
          <span>
            <Hint enabled={showHints} hint="runFade" term="Second-half drop-off" />
          </span>
          <strong>
            {formatTime(runFadePace)}/{distanceUnitLabels[distanceUnit]}
          </strong>
        </div>
        <div>
          <span>
            <Hint enabled={showHints} hint="targetGap" term="Time to find" />
          </span>
          <strong>{formatTime(analysis.targetGapSeconds)}</strong>
        </div>
      </div>

      <div id="report-target-path" className="report-scroll-anchor">
        <ReportSection title="Target path" defaultOpen>
        <div className="target-plan">
          <div className="target-plan__header">
            <div>
              <p className="eyebrow">Target path</p>
              <h3>{analysis.targetDifficultyLabel}</h3>
            </div>
            <strong>
              {analysis.requiredGainPercent > 0
                ? `${Math.round(analysis.requiredGainPercent * 1000) / 10}% gain`
                : "No gap"}
            </strong>
          </div>
          <p>{analysis.targetPlanSummary}</p>
          <div className="target-plan__grid">
            <div>
              <span>Run-only route</span>
              <strong>{formatTime(analysis.requiredGainPerRunSeconds)}</strong>
              <small>needed from each run</small>
            </div>
            <div>
              <span>Station-only route</span>
              <strong>{formatTime(analysis.requiredGainPerStationSeconds)}</strong>
              <small>needed from each station</small>
            </div>
            <div>
              <span>Balanced run target</span>
              <strong>{formatTime(analysis.targetRunAverageSeconds)}</strong>
              <small>average run split</small>
            </div>
            <div>
              <span>Balanced station target</span>
              <strong>{formatTime(analysis.targetStationAverageSeconds)}</strong>
              <small>average station split</small>
            </div>
          </div>
        </div>
        </ReportSection>
      </div>

      <div id="report-readiness" className="report-scroll-anchor">
        <ReportSection title="Readiness" defaultOpen>
          <div className="readiness-card">
            <div className="readiness-card__score">
              <span>{readinessLabel(readiness.overall)}</span>
              <strong>{readiness.overall}</strong>
              <small>/100</small>
            </div>
            <div className="readiness-card__body">
              <h3>How prepared this race profile looks</h3>
              <p>
                All numbers are out of 100. Higher means that part of the race is
                closer to target, more repeatable, or already well protected.
              </p>
              <div className="readiness-card__grid">
                <ReadinessMetric
                  label="Run control"
                  score={readiness.runControl}
                  detail="split variation"
                />
                <ReadinessMetric
                  label="Station control"
                  score={readiness.stationControl}
                  detail="benchmark gap"
                />
                <ReadinessMetric
                  label="Durability"
                  score={readiness.durability}
                  detail="late-race fade"
                />
                <ReadinessMetric
                  label="Target realism"
                  score={readiness.targetRealism}
                  detail="required gain"
                />
                <ReadinessMetric
                  label="Execution base"
                  score={readiness.executionBase}
                  detail="protected splits"
                />
              </div>
            </div>
          </div>
        </ReportSection>
      </div>

      <div id="report-strengths" className="report-scroll-anchor">
        <ReportSection title="Strengths" defaultOpen>
        <div className="positive-grid">
          <article>
            <span>Best controlled split</span>
            <h4>{bestSegment?.label ?? "Not clear"}</h4>
            <strong>{formatTime(bestSegment?.leakSeconds ?? 0)} from target</strong>
            <p>
              This is the split rhythm to protect and reuse around harder race
              sections.
            </p>
          </article>
          <article>
            <span>Strongest station</span>
            <h4>{bestStation?.label ?? "Not clear"}</h4>
            <strong>{describeGoodGap(bestStation?.gap ?? 0)}</strong>
            <p>
              {bestStation
                ? `${formatTime(bestStation.seconds)} against the ${analysis.levelLabel} station benchmark.`
                : "Add station splits to show your strongest benchmark match."}
            </p>
          </article>
          <article>
            <span>Reliable segments</span>
            <h4>
              {strongSegments.length}/{analysis.raceSegments.length}
            </h4>
            <strong>strong or protected</strong>
            <p>
              These sections are not the main limiter, so they should be
              maintained while training the bigger gaps.
            </p>
          </article>
          <article>
            <span>Run control</span>
            <h4>{formatTime(analysis.runVolatilitySeconds)}</h4>
            <strong>split variation</strong>
            <p>
              Lower variation means the run profile is easier to trust when
              setting future targets.
            </p>
          </article>
        </div>
        </ReportSection>
      </div>

      <div id="report-leaks" className="report-scroll-anchor">
        <h3>
          Main <Hint enabled={showHints} hint="timeLeak" term="time leaks" />
        </h3>
        <div className="leak-list">
          {visibleLeaks.map((leak, index) => (
            <article className="leak-card" key={leak.id}>
              <div>
                <span>#{index + 1}</span>
                <h4>{leak.label}</h4>
                <p>{leak.detail}</p>
              </div>
              <strong>{formatTime(leak.recoverableSeconds)}</strong>
            </article>
          ))}
        </div>
      </div>

      <div id="report-training" className="report-scroll-anchor">
      {!fullReportUnlocked ? (
        <div className="paywall">
          <div>
            <p className="eyebrow">Full report</p>
            <h3>
              Unlock Ocht premium <PremiumBadge />
            </h3>
            <p>
              Ocht premium includes the full leak list, four-week focus,
              heatmap, race story, report poster, target simulator, print view,
              and calculation breakdown.
            </p>
            <ul className="paywall__features">
              <li>Custom formats and saved templates</li>
              <li>Share images, print view, and coach summary</li>
              <li>Training priorities, simulator, and calculation detail</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={onStartCheckout}
            disabled={!canStartCheckout || billingLoading}
            data-analytics-source="paywall"
          >
            {billingLoading
              ? "Opening checkout..."
              : canStartCheckout
                ? "Unlock full report"
                : "Sign in to unlock"}
          </button>
        </div>
      ) : (
        <>
          <p className="helper-text" aria-live="polite">
            {exportMessage ||
              "Export includes the full leak list, training plan, target, and station ranking."}
          </p>

          <ReportSection title="Target simulator" defaultOpen premium>
            <TargetSimulator
              analysis={analysis}
              distanceUnit={distanceUnit}
              runGainPerKm={runGainPerKm}
              stationGain={stationGain}
              transitionGain={transitionGain}
              showHints={showHints}
              onRunGainPerKmChange={onRunGainPerKmChange}
              onStationGainChange={onStationGainChange}
              onTransitionGainChange={onTransitionGainChange}
            />
          </ReportSection>

          <ReportSection title="Training priorities" defaultOpen premium>
            <ol>
              {analysis.priorities.map((priority) => (
                <li key={priority}>{priority}</li>
              ))}
            </ol>
          </ReportSection>

          <ReportSection title="Four-week focus" premium>
            <div className="training-plan">
              {analysis.trainingPlan.map((week) => (
                <article className="training-week" key={week.week}>
                  <div className="training-week__header">
                    <span>Week {week.week}</span>
                    <h4>{week.focus}</h4>
                  </div>
                  <ul>
                    {week.sessions.map((session) => (
                      <li key={session}>{session}</li>
                    ))}
                  </ul>
                  <p>{week.target}</p>
                </article>
              ))}
            </div>
          </ReportSection>

          <ReportSection title="Station ranking" premium>
            <p className="helper-text">
              Each station is compared with the {analysis.levelLabel}{" "}
              <Hint enabled={showHints} hint="benchmark" term="benchmark" />.
            </p>
            <div className="station-table">
              {analysis.stationResults.map((station) => (
                <div key={station.key}>
                  <span>{station.label}</span>
                  <strong>{formatTime(station.gap)} leak</strong>
                </div>
              ))}
            </div>
          </ReportSection>

          <ReportSection title="Race story" premium>
            <RaceStory analysis={analysis} />
          </ReportSection>

          <ReportSection title="Time leak heatmap" premium>
            <TimeLeakHeatmap analysis={analysis} />
          </ReportSection>

          <ReportSection title="Calculation breakdown" premium>
            <CalculationExplainer analysis={analysis} distanceUnit={distanceUnit} />
          </ReportSection>
        </>
      )}
      </div>
      {shareModalOpen ? (
        <div
          className="share-preview-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShareModalOpen(false);
            }
          }}
        >
          <section
            className="share-carousel"
            aria-modal="true"
            role="dialog"
            aria-label="Share options preview"
          >
            <header className="share-carousel__header">
              <div>
                <span>Share preview</span>
                <h3>Choose what to share</h3>
              </div>
              <button type="button" onClick={() => setShareModalOpen(false)}>
                Close
              </button>
            </header>

            <div className="share-carousel__track" aria-label="Swipe share options">
              <article className="share-carousel__slide">
                <div className="share-carousel__copy-preview">
                  <img src="/brand/ocht-logo-wordmark.svg" alt="Ocht" />
                  <p>{analysis.report}</p>
                </div>
                <div className="share-carousel__content">
                  <span>Text summary</span>
                  <h4>Copy a clean report summary</h4>
                  <p>Best for notes, messages, or sending to a coach.</p>
                  <button type="button" onClick={() => void copyReport()}>
                    Copy summary
                  </button>
                </div>
              </article>

              <article className="share-carousel__slide">
                <div className="share-preview__report">
                  <img src="/brand/ocht-logo-wordmark.svg" alt="Ocht" />
                  <div>
                    <span>Projected finish</span>
                    <strong>{formatTime(analysis.finishSeconds)}</strong>
                  </div>
                  <div>
                    <span>Target path</span>
                    <strong>{formatTime(analysis.predictedTargetSeconds)}</strong>
                  </div>
                <div>
                  <span>Avg run</span>
                  <strong>{averageRunPace}</strong>
                </div>
                  <p>
                    The full report image includes the current report panel,
                    charts, premium sections, and calculation detail.
                  </p>
                </div>
                <div className="share-carousel__content">
                  <span>Full report image</span>
                  <h4>Share the complete report view</h4>
                  <p>Best for saving the whole analysis as one image.</p>
                  <button type="button" onClick={() => void shareReport()}>
                    Share full report image
                  </button>
                </div>
              </article>

              <article className="share-carousel__slide share-carousel__slide--poster">
                <div className="share-preview__poster">
                  <div className="share-preview__poster-mini">
                    <PremiumReportPoster
                      analysis={analysis}
                      distanceUnit={distanceUnit}
                    />
                  </div>
                </div>
                <div className="share-carousel__content">
                  <span>Story poster</span>
                  <h4>Share the social poster</h4>
                  <p>Best for Instagram stories, WhatsApp, or quick updates.</p>
                  <div className="share-carousel__buttons">
                    <button
                      type="button"
                      onClick={() => void copyPosterImage()}
                    >
                      Copy poster
                    </button>
                    <button
                      type="button"
                      onClick={() => void sharePosterImage()}
                    >
                      Share poster
                    </button>
                  </div>
                </div>
              </article>

              <article className="share-carousel__slide">
                <div className="share-carousel__file-preview">
                  <span>TXT</span>
                  <strong>ocht-race-report.txt</strong>
                  <p>Plain text export with targets, leaks, and rankings.</p>
                </div>
                <div className="share-carousel__content">
                  <span>Text file</span>
                  <h4>Download the report data</h4>
                  <p>Best for keeping a local copy or pasting into training logs.</p>
                  <button type="button" onClick={downloadReport}>
                    Download .txt
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>
      ) : null}
      {fullReportUnlocked ? (
        <div className="share-poster-capture" aria-hidden="true">
          <PremiumReportPoster
            analysis={analysis}
            distanceUnit={distanceUnit}
            captureRef={sharePosterCaptureRef}
          />
        </div>
      ) : null}
    </aside>
  );
}
