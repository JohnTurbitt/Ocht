import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { toBlob } from "html-to-image";
import { Analysis, formatTime, tierFor } from "@/lib/analysis";
import { trackEvent } from "@/lib/analytics";
import { SavedReport } from "@/lib/reportStorage";
import { buildPRMap } from "@/lib/prUtils";
import { calculateRaceReadiness, readinessLabel } from "@/lib/readiness";
import {
  TrainingContext,
  buildRunningDiagnosis,
} from "@/lib/trainingContext";
import {
  DistanceUnit,
  distanceUnitLabels,
  formatPaceForUnit,
  formatSpeedForUnit,
  secondsPerDistanceUnit,
} from "@/lib/units";
import { AthleteArchetypeCard } from "./AthleteArchetypeCard";
import { FitnessInsights } from "./FitnessInsights";
import { RaceBlueprint } from "./RaceBlueprint";
import { CalculationExplainer } from "./CalculationExplainer";
import { CountUp } from "./CountUp";
import { Hint } from "./Hint";
import { OctagonSpinner } from "./OctagonSpinner";
import { PremiumBadge } from "./PremiumBadge";
import { RaceFlowMap, RaceStory } from "./RaceVisuals";
import { RoxzoneCard } from "./RoxzoneCard";
import { ScoreGauge } from "./ScoreGauge";
import { ShareArchetypeCard, ShareFinishCard, ShareStoryCard } from "./ShareCards";
import { TargetSimulator } from "./TargetSimulator";

const JUMP_SECTIONS = [
  { id: "report-overview", label: "Overview" },
  { id: "report-profile", label: "Profile" },
  { id: "race-flow-map", label: "Flow" },
  { id: "report-target-path", label: "Target" },
  { id: "report-readiness", label: "Readiness" },
  { id: "report-strengths", label: "Strengths" },
  { id: "report-leaks", label: "Leaks" },
  { id: "report-training", label: "Training" },
];

type ReportPanelProps = {
  analysis: Analysis;
  distanceUnit: DistanceUnit;
  athleteName: string;
  avatarColor: string;
  avatarIcon: string;
  hasGeneratedReport: boolean;
  fullReportUnlocked: boolean;
  canStartCheckout: boolean;
  billingLoading: boolean;
  showHints: boolean;
  savedReports: SavedReport[];
  onStartCheckout: () => void;
  trainingContext: TrainingContext;
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

function TrainingPriority({ priority }: { priority: string }) {
  const [focus, ...detailParts] = priority.split(": ");
  const detail = detailParts.join(": ");

  if (!detail) {
    return <li>{priority}</li>;
  }

  return (
    <li className="training-priority">
      <strong className="training-priority__focus">{focus}</strong>
      <span>{detail}</span>
    </li>
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
        <CountUp value={score} />
        <small>/100</small>
      </strong>
      <em>{detail}</em>
    </span>
  );
}

const SHARE_TEMPLATES = ["finish", "archetype", "story"] as const;
const SHARE_LABELS: Record<typeof SHARE_TEMPLATES[number], string> = {
  finish: "Finish card",
  archetype: "Archetype",
  story: "Story card",
};

export function ReportPanel({
  analysis,
  distanceUnit,
  athleteName,
  avatarColor,
  avatarIcon,
  hasGeneratedReport,
  fullReportUnlocked,
  canStartCheckout,
  billingLoading,
  showHints,
  savedReports,
  onStartCheckout,
  trainingContext,
}: ReportPanelProps) {
  const reportCaptureRef = useRef<HTMLElement>(null);
  const jumpNavRef = useRef<HTMLElement>(null);
  const shareFinishRef = useRef<HTMLDivElement>(null);
  const shareArchetypeRef = useRef<HTMLDivElement>(null);
  const shareStoryRef = useRef<HTMLDivElement>(null);
  const [generatedDate, setGeneratedDate] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTemplate, setShareTemplate] = useState<"finish" | "archetype" | "story">(
    "finish",
  );
  const [flowModalRequest, setFlowModalRequest] = useState({
    segmentId: "",
    signal: 0,
  });
  const [activeSection, setActiveSection] = useState("report-overview");
  const visibleLeaks = fullReportUnlocked
    ? analysis.topLeaks
    : analysis.topLeaks.slice(0, 2);
  const primaryLeak = analysis.topLeaks[0];
  const bestSegment = [...analysis.raceSegments].sort(
    (a, b) => a.leakSeconds - b.leakSeconds,
  )[0];
  const bestStation = [...analysis.stationResults].sort((a, b) => a.gap - b.gap)[0];
  const prMap = useMemo(
    () => buildPRMap(savedReports, analysis.stationResults.map((sr) => sr.key)),
    [savedReports, analysis.stationResults]
  );
  const stationSliders = useMemo(
    () => analysis.stationResults.map((sr) => ({
      key: sr.key,
      label: sr.label,
      prSeconds: prMap.get(sr.key)?.seconds ?? sr.seconds,
      currentSeconds: sr.seconds,
    })),
    [analysis.stationResults, prMap]
  );
  const latestDate = useMemo(
    () => savedReports.length > 0
      ? savedReports.reduce((l, r) => r.createdAt > l ? r.createdAt : l, savedReports[0].createdAt)
      : null,
    [savedReports]
  );
  const prRows = useMemo(
    () => analysis.stationResults.map((sr) => ({
      label: sr.label,
      time: formatTime(sr.seconds),
      isNew: latestDate !== null && prMap.get(sr.key)?.createdAt === latestDate,
    })),
    [analysis.stationResults, prMap, latestDate]
  );
  const strongSegments = analysis.raceSegments.filter(
    (segment) => segment.status === "strong",
  );
  const readiness = calculateRaceReadiness(analysis);
  const runningDiagnosis = buildRunningDiagnosis(analysis, trainingContext);

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
  const realisticGainDetail =
    analysis.targetGapSeconds > 0
      ? `${Math.round(
          Math.min(100, (analysis.recoverableSeconds / analysis.targetGapSeconds) * 100),
        )}% of target gap`
      : "protect this target";

  function openRaceFlowSegment(segmentId?: string) {
    if (!segmentId) {
      scrollToReportSection("race-flow-map");
      return;
    }

    setFlowModalRequest((current) => ({
      segmentId,
      signal: current.signal + 1,
    }));
  }

  function getPrimaryLeakSegmentId() {
    if (!primaryLeak) {
      return bestSegment?.id;
    }

    if (primaryLeak.type === "station") {
      return `station-${primaryLeak.id}`;
    }

    return [...analysis.raceSegments]
      .filter((segment) => segment.type === "run")
      .sort((a, b) => b.leakSeconds - a.leakSeconds)[0]?.id;
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
    const sections = JUMP_SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((element): element is HTMLElement => Boolean(element));

    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );

        if (visible[0]) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nav = jumpNavRef.current;
    const activeButton = nav?.querySelector<HTMLElement>("button.is-active");

    if (!nav || !activeButton) {
      return;
    }

    // Centre the active chip within the nav's own horizontal scroll only â€”
    // never call scrollIntoView, which would also scroll the page vertically.
    const navRect = nav.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const delta =
      buttonRect.left +
      buttonRect.width / 2 -
      (navRect.left + navRect.width / 2);

    nav.scrollBy({ left: delta, behavior: "smooth" });
  }, [activeSection]);

  const activeShareRef =
    shareTemplate === "finish" ? shareFinishRef :
    shareTemplate === "story" ? shareStoryRef :
    shareArchetypeRef;
  const shareIdx = SHARE_TEMPLATES.indexOf(shareTemplate);

  async function createCardBlob(targetRef: RefObject<HTMLDivElement | null>) {
    if (!targetRef.current) {
      return null;
    }

    return toBlob(targetRef.current, {
      cacheBust: true,
      pixelRatio: 2,
    });
  }

  async function copyCardImage(targetRef: RefObject<HTMLDivElement | null>) {
    try {
      const cardBlob = await createCardBlob(targetRef);

      if (!cardBlob) {
        setExportMessage("Card was not ready to copy.");
        return;
      }

      if ("ClipboardItem" in window && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ [cardBlob.type]: cardBlob }),
        ]);
        setExportMessage("Card image copied.");
        trackEvent("report_exported", {
          format: `card_clipboard_${shareTemplate}`,
        });
        return;
      }

      setExportMessage("Image clipboard is not supported in this browser.");
    } catch {
      setExportMessage("Card copy was blocked by the browser.");
    }
  }

  async function shareCardImage(targetRef: RefObject<HTMLDivElement | null>) {
    try {
      const cardBlob = await createCardBlob(targetRef);

      if (!cardBlob) {
        setExportMessage("Card was not ready to share.");
        return;
      }

      const cardFile = new File([cardBlob], `ocht-${shareTemplate}-card.png`, {
        type: "image/png",
      });
      const shareData = {
        files: [cardFile],
        text: "My Ocht race card",
        title: "Ocht",
      };

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        setExportMessage("Card shared.");
        trackEvent("report_exported", {
          format: `card_share_${shareTemplate}`,
        });
        return;
      }

      await copyCardImage(targetRef);
    } catch {
      setExportMessage("Card share was cancelled or blocked.");
    }
  }

  async function downloadCardImage(targetRef: RefObject<HTMLDivElement | null>) {
    try {
      const cardBlob = await createCardBlob(targetRef);

      if (!cardBlob) {
        setExportMessage("Card was not ready to download.");
        return;
      }

      const cardUrl = URL.createObjectURL(cardBlob);
      const cardLink = document.createElement("a");

      cardLink.href = cardUrl;
      cardLink.download = `ocht-${shareTemplate}-card.png`;
      cardLink.click();
      URL.revokeObjectURL(cardUrl);
      setExportMessage("Card downloaded.");
      trackEvent("report_exported", {
        format: `card_download_${shareTemplate}`,
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
            <small>{realisticGainDetail}</small>
          </div>
          <button
            className="race-cockpit__stat race-cockpit__stat--button"
            type="button"
            onClick={() => openRaceFlowSegment(getPrimaryLeakSegmentId())}
          >
            <span>Biggest leak</span>
            <strong>{primaryLeak?.label ?? "Not clear"}</strong>
            <small>{biggestLeakDetail}</small>
            <em>Click for more info</em>
          </button>
          <button
            className="race-cockpit__stat race-cockpit__stat--button"
            type="button"
            onClick={() => openRaceFlowSegment(bestSegment?.id)}
          >
            <span>Most controlled split</span>
            <strong>{bestSegment?.label ?? "Not clear"}</strong>
            <small>{bestSplitDetail}</small>
            <em>Click for more info</em>
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

      <nav className="report-jump-nav" aria-label="Report sections" ref={jumpNavRef}>
        {JUMP_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeSection === section.id ? "is-active" : undefined}
            onClick={() => scrollToReportSection(section.id)}
          >
            {section.label}
          </button>
        ))}
        <button
          type="button"
          className="report-jump-nav__cta"
          onClick={() => {
            setShareModalOpen(true);
            trackEvent("share_options_opened");
          }}
        >
          Share
        </button>
      </nav>

      <div id="report-profile" className="report-scroll-anchor">
        <div className="archetype-hero">
          <AthleteArchetypeCard analysis={analysis} />
          <button
            type="button"
            className="archetype-hero__share"
            onClick={() => {
              setShareTemplate("archetype");
              setShareModalOpen(true);
              trackEvent("share_options_opened");
            }}
            aria-label="Share your archetype"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
              <path d="M12 16V4" />
              <path d="M7 9l5-5 5 5" />
            </svg>
            Share archetype
          </button>
        </div>
        <div className="premium-highlights">
          <RoxzoneCard analysis={analysis} />
        </div>
      </div>

      <div id="race-flow-map" className="report-scroll-anchor">
        <ReportSection title="Race flow map" defaultOpen>
          <RaceFlowMap
            analysis={analysis}
            distanceUnit={distanceUnit}
            openSegmentId={flowModalRequest.segmentId}
            openSignal={flowModalRequest.signal}
          />
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
              <ScoreGauge
                score={readiness.overall}
                label={readinessLabel(readiness.overall)}
              />
            </div>
            <div className="readiness-card__body">
              <h3>
                What your{" "}
                <Hint enabled={showHints} hint="readiness" term="readiness score" />{" "}
                means
              </h3>
              <p>
                A single 0-100 read on how race-ready this profile looks. It blends
                run pacing control, station times vs the benchmark, late-race
                durability and how realistic your target is. Each metric below is
                also out of 100; higher is closer to race-ready.
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

      <FitnessInsights fullReportUnlocked={fullReportUnlocked} />

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
        <ReportSection title="Training diagnosis" defaultOpen>
          {runningDiagnosis ? (
            <div className="running-diagnosis">
              <div className="running-diagnosis__summary">
                <span>Likely limiter / {runningDiagnosis.confidence} confidence</span>
                <h3>{runningDiagnosis.title}</h3>
                <p>{runningDiagnosis.summary}</p>
              </div>
              <div className="running-diagnosis__metrics">
                {runningDiagnosis.metrics.map((metric) => (
                  <article
                    className={`running-diagnosis__metric running-diagnosis__metric--${metric.status}`}
                    key={metric.label}
                  >
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <p>{metric.detail}</p>
                  </article>
                ))}
              </div>
              <div className="running-diagnosis__grid">
                <div>
                  <span>Evidence</span>
                  <ul>
                    {runningDiagnosis.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span>This week</span>
                  <ul>
                    {runningDiagnosis.weeklyFocus.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="running-diagnosis running-diagnosis--empty">
              <div className="running-diagnosis__summary">
                <span>Manual context</span>
                <h3>Add recent training to sharpen this</h3>
                <p>
                  The race math still works without it. Add recent running volume,
                  hard sessions, compromised runs and rest days to get a more
                  useful running recommendation.
                </p>
              </div>
              <a href="/settings?section=privacy" className="strava-upsell">
                <strong>Auto-fill from Strava</strong>
                <p>Connect in Settings to fill in your training data automatically.</p>
              </a>
            </div>
          )}
        </ReportSection>

        <RaceBlueprint analysis={analysis} fullReportUnlocked={fullReportUnlocked} />

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
              <li>Target simulator, four-week plan and full leak list</li>
              <li>Detailed race flow map and calculation breakdown</li>
              <li>Share images, print view and coach summary</li>
            </ul>
          </div>
          <button
            className="btn btn--primary btn--cut"
            type="button"
            onClick={onStartCheckout}
            disabled={!canStartCheckout || billingLoading}
            data-analytics-source="paywall"
          >
            {billingLoading ? (
              <span className="button-loading">
                <OctagonSpinner size={18} />
                Opening checkout...
              </span>
            ) : canStartCheckout ? (
              "Unlock full report"
            ) : (
              "Sign in to unlock"
            )}
          </button>
        </div>
      ) : (
        <>
          <p className="helper-text" aria-live="polite">
            {exportMessage ||
              "Export includes the full leak list, training plan, target and station ranking."}
          </p>

          <ReportSection title="Target simulator" defaultOpen premium>
            <TargetSimulator key={analysis.finishSeconds} stations={stationSliders} />
          </ReportSection>

          <ReportSection title="Training priorities" defaultOpen premium>
            <ol>
              {analysis.priorities.map((priority) => (
                <TrainingPriority key={priority} priority={priority} />
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

          <ReportSection title="Race story" premium>
            <RaceStory analysis={analysis} />
          </ReportSection>

          <ReportSection title="Calculation breakdown" premium>
            <CalculationExplainer analysis={analysis} distanceUnit={distanceUnit} />
          </ReportSection>
        </>
      )}
      </div>
      {shareModalOpen ? createPortal(
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
            className="share-studio"
            aria-modal="true"
            role="dialog"
            aria-label="Share your race"
          >
            <header className="share-studio__header">
              <div>
                <span>Share studio</span>
                <h3>Share your race</h3>
              </div>
              <button
                className="modal-close"
                type="button"
                onClick={() => setShareModalOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </header>

            <div className="share-studio__carousel">
              <button
                className="share-studio__arrow"
                type="button"
                onClick={() => setShareTemplate(SHARE_TEMPLATES[(shareIdx + 2) % 3])}
                aria-label="Previous card"
              >
                ‹
              </button>
              <div className="share-studio__carousel-viewport">
                <div
                  className="share-studio__carousel-track"
                  style={{ transform: `translateX(-${(shareIdx * 100) / 3}%)` }}
                >
                  <div className="share-studio__carousel-slide">
                    <div className="share-studio__frame">
                      <div className="share-studio__scale">
                        <ShareFinishCard
                          analysis={analysis}
                          generatedDate={generatedDate}
                          athleteName={athleteName}
                          avatarColor={avatarColor}
                          avatarIcon={avatarIcon}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="share-studio__carousel-slide">
                    <div className="share-studio__frame">
                      <div className="share-studio__scale">
                        <ShareArchetypeCard
                          analysis={analysis}
                          generatedDate={generatedDate}
                          athleteName={athleteName}
                          avatarColor={avatarColor}
                          avatarIcon={avatarIcon}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="share-studio__carousel-slide">
                    <div className="share-studio__frame">
                      <div className="share-studio__scale">
                        <ShareStoryCard
                          score={readiness.overall}
                          tierLabel={tierFor(readiness.overall).label}
                          athleteName={athleteName}
                          eventDate={generatedDate}
                          prRows={prRows}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button
                className="share-studio__arrow"
                type="button"
                onClick={() => setShareTemplate(SHARE_TEMPLATES[(shareIdx + 1) % 3])}
                aria-label="Next card"
              >
                ›
              </button>
            </div>
            <div className="share-studio__carousel-footer">
              <span className="share-studio__card-label">{SHARE_LABELS[shareTemplate]}</span>
              <div className="share-studio__dots">
                {SHARE_TEMPLATES.map((t, i) => (
                  <button
                    key={t}
                    type="button"
                    className={`share-studio__dot${i === shareIdx ? " share-studio__dot--active" : ""}`}
                    onClick={() => setShareTemplate(t)}
                    aria-label={SHARE_LABELS[t]}
                  />
                ))}
              </div>
            </div>

            <div className="share-studio__actions">
              <button
                className="btn btn--primary btn--block"
                type="button"
                onClick={() => void shareCardImage(activeShareRef)}
              >
                <svg
                  className="btn__icon"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                  <path d="M12 16V4" />
                  <path d="M7 9l5-5 5 5" />
                </svg>
                Share&hellip;
              </button>
              <div className="share-studio__row">
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => void copyCardImage(activeShareRef)}
                >
                  <svg
                    className="btn__icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                  Copy
                </button>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={() => void downloadCardImage(activeShareRef)}
                >
                  <svg
                    className="btn__icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Save PNG
                </button>
              </div>
            </div>

            <p className="share-studio__status" aria-live="polite">
              {exportMessage}
            </p>
          </section>
        </div>,
        document.body,
      ) : null}
      {fullReportUnlocked ? (
        <div className="share-capture" aria-hidden="true">
          <ShareFinishCard
            analysis={analysis}
            generatedDate={generatedDate}
            athleteName={athleteName}
            avatarColor={avatarColor}
            avatarIcon={avatarIcon}
            captureRef={shareFinishRef}
          />
          <ShareArchetypeCard
            analysis={analysis}
            generatedDate={generatedDate}
            athleteName={athleteName}
            avatarColor={avatarColor}
            avatarIcon={avatarIcon}
            captureRef={shareArchetypeRef}
          />
          <ShareStoryCard
            score={readiness.overall}
            tierLabel={tierFor(readiness.overall).label}
            athleteName={athleteName}
            eventDate={generatedDate}
            prRows={prRows}
            captureRef={shareStoryRef}
          />
        </div>
      ) : null}
    </aside>
  );
}


