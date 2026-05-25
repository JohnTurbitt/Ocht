"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import { Analysis, RaceSegment, formatTime } from "@/lib/analysis";
import {
  DistanceUnit,
  formatPaceForUnit,
  formatSpeedForUnit,
} from "@/lib/units";

type RaceVisualProps = {
  analysis: Analysis;
  distanceUnit?: DistanceUnit;
};

type PremiumReportPosterProps = RaceVisualProps & {
  captureRef?: RefObject<HTMLDivElement | null>;
};

type FlowChartSegment = RaceSegment & {
  actualElapsed: number;
  chartValue: number;
  cumulativeGapSeconds: number;
  displayTime: string;
  phase: string;
  shortLabel: string;
  speedLabel: string;
  topLeakRank: number;
};

function TrophyIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M16 8 H32 V20 C32 26 28 30 24 30 C20 30 16 26 16 20 V8 Z" />
      <path d="M16 12 H9 V17 C9 22 12 25 17 25" />
      <path d="M32 12 H39 V17 C39 22 36 25 31 25" />
      <path d="M24 30 V37" />
      <path d="M17 40 H31" />
      <path d="M20 37 H28" />
      <path d="M21 16 H27" />
      <path d="M19 21 H29" />
    </svg>
  );
}

type FlowBarShapeProps = Partial<BarShapeProps> & {
  selectedSegmentId: string;
  onSegmentHover: (segmentId: string) => void;
  onSegmentSelect: (segmentId: string) => void;
};

type SegmentInsightPanelProps = {
  segment: FlowChartSegment;
  onClose: () => void;
};

function statusLabel(status: RaceSegment["status"]) {
  if (status === "leak") {
    return "Leak";
  }

  if (status === "steady") {
    return "Watch";
  }

  return "Strong";
}

function statusColor(status: RaceSegment["status"]) {
  if (status === "leak") {
    return "var(--red)";
  }

  if (status === "steady") {
    return "var(--mid-green)";
  }

  return "var(--lime)";
}

function shortenLabel(label: string) {
  return label
    .replace("Burpee broad jumps", "Burpees")
    .replace("Sandbag lunges", "Lunges")
    .replace("Farmers carry", "Farmers")
    .replace("Wall balls", "Wall balls")
    .replace("Sled push", "Push")
    .replace("Sled pull", "Pull");
}

function segmentGrade(segment: RaceSegment) {
  if (segment.status === "strong") {
    return segment.leakSeconds === 0 ? "A" : "B";
  }

  if (segment.status === "steady") {
    return "C";
  }

  return segment.intensity > 0.84 ? "D" : "C-";
}

function phaseLabel(index: number, totalSegments: number) {
  const progress = (index + 1) / totalSegments;

  if (progress <= 0.34) {
    return "Opening phase";
  }

  if (progress <= 0.68) {
    return "Middle phase";
  }

  return "Closing phase";
}

function buildCoachRead(segment: RaceSegment, cumulativeGapSeconds: number) {
  const phase = segment.type === "run" ? "run split" : "station split";
  const cumulativeGap = formatTime(Math.max(0, cumulativeGapSeconds));

  if (segment.status === "strong") {
    return `${segment.label} is protecting the target profile. Keep this ${phase} controlled so later race sections do not inherit extra fatigue.`;
  }

  if (segment.status === "steady") {
    return `${segment.label} is a watch zone. It is not the biggest leak, but by this point the race is carrying ${cumulativeGap} of cumulative target pressure.`;
  }

  return `${segment.label} is separating from the target profile. This is a high-value training focus because the race has accumulated ${cumulativeGap} of gap by this point.`;
}

function SegmentInsightPanel({ segment, onClose }: SegmentInsightPanelProps) {
  return (
    <article
      className={`segment-insight segment-insight--${segment.status}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="race-flow-dialog-title"
    >
      <button
        className="segment-insight__close"
        type="button"
        onClick={onClose}
        aria-label="Close segment details"
      >
        Close
      </button>

      <header className="segment-insight__header">
        <span>
          {segment.phase} / {statusLabel(segment.status)}
        </span>
        <h4 id="race-flow-dialog-title">{segment.label}</h4>
        <strong>{segmentGrade(segment)}</strong>
      </header>

      <div className="segment-insight__primary">
        <div>
          <span>Actual</span>
          <strong>{formatTime(segment.actualSeconds)}</strong>
          {segment.speedLabel ? <small>{segment.speedLabel}</small> : null}
        </div>
        <div>
          <span>Target</span>
          <strong>{formatTime(segment.targetSeconds)}</strong>
        </div>
        <div>
          <span>Leak</span>
          <strong>{formatTime(segment.leakSeconds)}</strong>
        </div>
      </div>

      <div className="segment-insight__secondary">
        <div>
          <span>Cumulative</span>
          <strong>{formatTime(segment.actualElapsed)}</strong>
        </div>
        <div>
          <span>Cum. gap</span>
          <strong>{formatTime(segment.cumulativeGapSeconds)}</strong>
        </div>
        <div>
          <span>Race share</span>
          <strong>{Math.round(segment.widthPercent)}%</strong>
        </div>
      </div>

      <p>{buildCoachRead(segment, segment.cumulativeGapSeconds)}</p>
    </article>
  );
}


function FlowBarShape({
  x,
  y,
  width,
  height,
  payload,
  selectedSegmentId,
  onSegmentHover,
  onSegmentSelect,
}: FlowBarShapeProps) {
  const segment = payload as FlowChartSegment;
  const barX = Number(x ?? 0);
  const barY = Number(y ?? 0);
  const barWidth = Number(width ?? 0);
  const barHeight = Number(height ?? 0);
  const isSelected = selectedSegmentId === segment.id;
  const lostRatio =
    segment.actualSeconds > 0
      ? Math.min(segment.leakSeconds / segment.actualSeconds, 1)
      : 0;
  const lostWidth = barWidth * lostRatio;
  const labelX = barX + barWidth + 8;
  const labelY = barY + barHeight / 2 + 4;
  const rankX = barX + Math.max(12, barWidth - 10);
  const rankY = barY + barHeight / 2;

  function selectSegment() {
    onSegmentSelect(segment.id);
  }

  return (
    <g
      className="race-flow-svg__bar"
      role="button"
      tabIndex={0}
      aria-label={`${segment.label}: ${formatTime(segment.actualSeconds)}`}
      onPointerDown={(event) => {
        event.preventDefault();
        selectSegment();
      }}
      onClick={selectSegment}
      onFocus={() => onSegmentHover(segment.id)}
      onMouseEnter={() => onSegmentHover(segment.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectSegment();
        }
      }}
    >
      <rect
        x={barX}
        y={barY}
        width={barWidth}
        height={barHeight}
        rx={8}
        fill={statusColor(segment.status)}
        stroke={isSelected ? "var(--ink)" : "rgba(11, 18, 15, 0.22)"}
        strokeWidth={isSelected ? 3 : 1}
      />
      {lostWidth > 2 ? (
        <rect
          className="race-flow-svg__lost"
          x={barX + barWidth - lostWidth}
          y={barY}
          width={lostWidth}
          height={barHeight}
          rx={8}
        />
      ) : null}
      {segment.topLeakRank ? (
        <g transform={`translate(${rankX} ${rankY}) rotate(-45)`}>
          <path className="race-flow-svg__leak" d="M0 -9 C5 -4 8 0 8 5 C8 10 4 14 0 14 C-4 14 -8 10 -8 5 C-8 0 -5 -4 0 -9 Z" />
          <text
            className="race-flow-svg__leak-text"
            transform="rotate(45)"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {segment.topLeakRank}
          </text>
        </g>
      ) : null}
      <text
        className="race-flow-svg__time"
        x={labelX}
        y={labelY}
        textAnchor="start"
      >
        {segment.displayTime}
      </text>
    </g>
  );
}

export function RaceFlowMap({
  analysis,
  distanceUnit = "km",
}: RaceVisualProps) {
  const [compactChart, setCompactChart] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSegmentId, setModalSegmentId] = useState("");
  const cumulativeSegments = useMemo(() => {
    let actualElapsed = 0;
    let targetElapsed = 0;
    const topLeakRanks = new Map(
      [...analysis.raceSegments]
        .sort((a, b) => b.leakSeconds - a.leakSeconds)
        .slice(0, 3)
        .map((segment, index) => [segment.id, index + 1]),
    );

    return analysis.raceSegments.map((segment, index) => {
      actualElapsed += segment.actualSeconds;
      targetElapsed += segment.targetSeconds;

      return {
        ...segment,
        actualElapsed,
        chartValue: segment.actualSeconds,
        cumulativeGapSeconds: Math.max(0, actualElapsed - targetElapsed),
        displayTime: formatTime(segment.actualSeconds),
        phase: phaseLabel(index, analysis.raceSegments.length),
        shortLabel: shortenLabel(segment.label),
        speedLabel:
          segment.type === "run"
            ? formatSpeedForUnit(
                segment.actualSeconds,
                analysis.raceFormat,
                distanceUnit,
              )
            : "",
        topLeakRank: topLeakRanks.get(segment.id) ?? 0,
      };
    });
  }, [analysis.raceFormat, analysis.raceSegments, distanceUnit]);
  const defaultSegment = useMemo(
    () =>
      [...cumulativeSegments].sort(
        (a, b) => b.leakSeconds - a.leakSeconds,
      )[0] ?? cumulativeSegments[0],
    [cumulativeSegments],
  );
  const [selectedSegmentId, setSelectedSegmentId] = useState(
    defaultSegment?.id ?? "",
  );
  const selectedSegment =
    cumulativeSegments.find((segment) => segment.id === selectedSegmentId) ??
    defaultSegment;
  const modalSegment =
    cumulativeSegments.find((segment) => segment.id === modalSegmentId) ??
    selectedSegment;
  const chartHeight = Math.max(
    compactChart ? 500 : 560,
    cumulativeSegments.length * (compactChart ? 26 : 34) +
      (compactChart ? 88 : 118),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");

    setCompactChart(mediaQuery.matches);

    function handleChange(event: MediaQueryListEvent) {
      setCompactChart(event.matches);
    }

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalOpen]);

  function selectSegment(segmentId: string) {
    setSelectedSegmentId(segmentId);
    setModalSegmentId(segmentId);
    setModalOpen(true);
  }

  return (
    <div className="race-visual race-flow">
      <div className="race-flow__header">
        <span>Segment</span>
        <span>Split duration</span>
      </div>
      <div className="race-flow__chart" aria-label="Race flow map">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={cumulativeSegments}
            margin={
              compactChart
                ? { top: 10, right: 44, bottom: 22, left: 0 }
                : { top: 18, right: 70, bottom: 30, left: 8 }
            }
          >
            <defs>
              <pattern
                id="race-flow-lost-zone"
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="8" height="8" fill="rgba(11, 18, 15, 0.12)" />
                <rect width="3" height="8" fill="rgba(255, 255, 255, 0.36)" />
              </pattern>
            </defs>
            <CartesianGrid stroke="var(--line)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value) => formatTime(Number(value))}
              tick={{ fill: "var(--muted)", fontSize: 12, fontWeight: 800 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              dataKey="shortLabel"
              type="category"
              tick={{
                fill: "var(--muted)",
                fontSize: compactChart ? 10 : 12,
                fontWeight: 800,
              }}
              tickLine={false}
              axisLine={{ stroke: "var(--line)" }}
              width={compactChart ? 68 : 88}
            />
            <Bar
              dataKey="chartValue"
              maxBarSize={compactChart ? 28 : 44}
              shape={
                <FlowBarShape
                  selectedSegmentId={selectedSegment?.id ?? ""}
                  onSegmentHover={setSelectedSegmentId}
                  onSegmentSelect={selectSegment}
                />
              }
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {modalOpen && modalSegment ? (
        <div
          className="race-flow-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(false);
            }
          }}
        >
          <SegmentInsightPanel
            segment={modalSegment}
            onClose={() => setModalOpen(false)}
          />
        </div>
      ) : null}
      <div className="race-visual__legend">
        <span className="race-visual__legend-item race-visual__legend-item--strong">
          Strong
        </span>
        <span className="race-visual__legend-item race-visual__legend-item--steady">
          Watch
        </span>
        <span className="race-visual__legend-item race-visual__legend-item--leak">
          Leak
        </span>
        <span className="race-visual__legend-item race-visual__legend-item--target">
          Lost-time zone
        </span>
        <span className="race-visual__legend-item race-visual__legend-item--pin">
          Leak marker
        </span>
      </div>
    </div>
  );
}

export function TimeLeakHeatmap({ analysis }: RaceVisualProps) {
  const columns = Math.ceil(Math.sqrt(analysis.raceSegments.length));
  const maxLeakSeconds = Math.max(
    1,
    ...analysis.raceSegments.map((segment) => segment.leakSeconds),
  );

  return (
    <div className="race-visual heatmap-panel">
      <div
        className="heatmap-grid"
        style={{ "--heatmap-columns": columns } as CSSProperties}
      >
        {analysis.raceSegments.map((segment, index) => {
          const heat = Math.min(segment.leakSeconds / maxLeakSeconds, 1);
          const hue = Math.round(126 - heat * 120);
          const lightness = Math.round(72 - heat * 20);

          return (
            <article
              className="heatmap__cell"
              key={segment.id}
              style={
                {
                  "--heat": heat,
                  "--heat-color": `hsl(${hue} 86% ${lightness}%)`,
                } as CSSProperties
              }
            >
              <span>{index + 1}</span>
              <strong>{shortenLabel(segment.label)}</strong>
              <small>{formatTime(segment.leakSeconds)}</small>
            </article>
          );
        })}
      </div>
      <div className="heatmap-scale" aria-label="Heatmap scale">
        <span>Low leak</span>
        <i />
        <span>High leak</span>
      </div>
    </div>
  );
}

function phaseSummary(
  segments: RaceSegment[],
  label: string,
  fallback: RaceSegment,
) {
  const actualSeconds = segments.reduce(
    (total, segment) => total + segment.actualSeconds,
    0,
  );
  const targetSeconds = segments.reduce(
    (total, segment) => total + segment.targetSeconds,
    0,
  );
  const totalLeak = segments.reduce((total, segment) => total + segment.leakSeconds, 0);
  const mainLeak =
    [...segments].sort((a, b) => b.leakSeconds - a.leakSeconds)[0] ?? fallback;
  const averageIntensity =
    segments.reduce((total, segment) => total + segment.intensity, 0) /
    Math.max(segments.length, 1);
  const status =
    averageIntensity >= 0.66
      ? "leak" as const
      : averageIntensity >= 0.28
        ? "steady" as const
        : "strong" as const;

  return {
    actualSeconds,
    label,
    mainLeak,
    status,
    targetSeconds,
    totalLeak,
  };
}

function raceStoryTone(analysis: Analysis) {
  if (analysis.targetGapSeconds <= 0) {
    return "This is already tracking inside the target profile. The job now is protecting the same rhythm under race pressure.";
  }

  if (analysis.requiredGainPercent <= 3) {
    return "The target is close. This is a precision race now: clean transitions, fewer station pauses, and no late pacing drift.";
  }

  if (analysis.requiredGainPercent <= 8) {
    return "The race is recoverable, but the gain has to come from the biggest leaks first rather than general fitness work.";
  }

  return "The current target is aggressive from these splits. Keep it visible, but use the top leaks as the first performance block.";
}

function raceStoryAction(analysis: Analysis) {
  const primary = analysis.topLeaks[0];
  const secondary = analysis.topLeaks[1];

  if (!primary) {
    return "Capture one more complete report before changing training direction.";
  }

  if (!secondary) {
    return `Make ${primary.label.toLowerCase()} repeatable first; it is the only clear limiter in this report.`;
  }

  return `Pair ${primary.label.toLowerCase()} with ${secondary.label.toLowerCase()} in the same session so the main leak is trained under real fatigue.`;
}

export function RaceStory({ analysis }: RaceVisualProps) {
  const segmentCount = analysis.raceSegments.length;
  const phaseSize = Math.ceil(segmentCount / 3);
  const fallback = analysis.raceSegments[0];
  const phases = [
    phaseSummary(
      analysis.raceSegments.slice(0, phaseSize),
      "Opening",
      fallback,
    ),
    phaseSummary(
      analysis.raceSegments.slice(phaseSize, phaseSize * 2),
      "Middle",
      fallback,
    ),
    phaseSummary(
      analysis.raceSegments.slice(phaseSize * 2),
      "Closing",
      fallback,
    ),
  ];
  const totalLeak = phases.reduce((total, phase) => total + phase.totalLeak, 0);
  const pressurePhase = [...phases].sort((a, b) => b.totalLeak - a.totalLeak)[0];
  const bestSegment = [...analysis.raceSegments].sort(
    (a, b) => a.leakSeconds - b.leakSeconds,
  )[0];
  const breakPoint = analysis.raceSegments.find(
    (segment) =>
      segment.leakSeconds >=
      Math.max(12, (analysis.topLeaks[0]?.leakSeconds ?? 0) * 0.65),
  );
  const openingLeak = phases[0]?.totalLeak ?? 0;
  const closingLeak = phases[2]?.totalLeak ?? 0;
  const fatigueSwing = closingLeak - openingLeak;

  return (
    <div className="race-story">
      <div className="race-story__headline">
        <span>Race story</span>
        <h3>{pressurePhase.label} phase carried the most time leak.</h3>
        <p>{raceStoryTone(analysis)}</p>
      </div>

      <div className="race-story__phases">
        {phases.map((phase) => {
          const leakShare =
            totalLeak > 0 ? Math.round((phase.totalLeak / totalLeak) * 100) : 0;

          return (
            <article
              className={`race-story__phase race-story__phase--${phase.status}`}
              key={phase.label}
            >
              <span>{phase.label}</span>
              <h4>{statusLabel(phase.status)}</h4>
              <strong>{formatTime(phase.totalLeak)} leak</strong>
              <div
                aria-label={`${phase.label} leak share ${leakShare}%`}
                className="race-story__bar"
              >
                <i
                  style={{
                    width: `${Math.max(leakShare, phase.totalLeak > 0 ? 8 : 0)}%`,
                  }}
                />
              </div>
              <p>
                {phase.totalLeak > 0
                  ? `${phase.mainLeak.label} drove the pressure here across ${formatTime(
                      phase.actualSeconds,
                    )} of racing.`
                  : `This phase stayed inside the ${formatTime(phase.targetSeconds)} target block.`}
              </p>
            </article>
          );
        })}
      </div>

      <div className="race-story__readouts">
        <article>
          <span>Turning point</span>
          <strong>{breakPoint?.label ?? analysis.topLeaks[0]?.label ?? "Not clear"}</strong>
          <p>
            {breakPoint
              ? `${formatTime(breakPoint.leakSeconds)} leaked here, which is where the race profile starts needing attention.`
              : "No single segment forced a clear change in the story."}
          </p>
        </article>
        <article>
          <span>Protected split</span>
          <strong>{bestSegment?.label ?? "Not clear"}</strong>
          <p>
            {bestSegment
              ? `${formatTime(bestSegment.leakSeconds)} leak against target. This is the rhythm to reuse around weaker segments.`
              : "Add more complete splits to identify what is already working."}
          </p>
        </article>
        <article>
          <span>Fatigue signal</span>
          <strong>
            {fatigueSwing > 0 ? "+" : ""}
            {formatTime(Math.abs(fatigueSwing))}
          </strong>
          <p>
            {fatigueSwing > 0
              ? "Closing leak rose versus the opening phase, pointing to late-race durability."
              : "Closing leak did not rise versus the opening phase, so the issue is more specific than general fade."}
          </p>
        </article>
      </div>

      <p className="race-story__readout">
        {analysis.topLeaks[0]
          ? `${analysis.topLeaks[0].label} is the clearest headline: ${formatTime(
              analysis.topLeaks[0].recoverableSeconds,
            )} is realistically recoverable. ${raceStoryAction(analysis)}`
          : raceStoryAction(analysis)}
      </p>
    </div>
  );
}

export function PremiumReportPoster({
  analysis,
  captureRef,
  distanceUnit = "km",
}: PremiumReportPosterProps) {
  const bestSegment = [...analysis.raceSegments].sort(
    (a, b) => a.leakSeconds - b.leakSeconds,
  )[0];
  const bestRun = [...analysis.raceSegments]
    .filter((segment) => segment.type === "run")
    .sort((a, b) => a.actualSeconds - b.actualSeconds)[0];
  const bestStation = [...analysis.stationResults].sort((a, b) => a.gap - b.gap)[0];
  const shareSplits = [...analysis.raceSegments]
    .sort((a, b) => a.actualSeconds - b.actualSeconds)
    .slice(0, 6);
  const averageRunPace = formatPaceForUnit(
    analysis.averageRunSeconds,
    analysis.raceFormat,
    distanceUnit,
  );

  return (
    <div className="poster-card" ref={captureRef}>
      <header className="poster-card__header">
        <div>
          <div className="poster-card__brand">
            <img
              src="/brand/ocht-logo-wordmark.svg"
              alt="Ocht"
            />
          </div>
          <h3>{formatTime(analysis.finishSeconds)}</h3>
        </div>
      </header>
      <div className="poster-card__stats">
        <div>
          <span>Target path</span>
          <strong>{formatTime(analysis.predictedTargetSeconds)}</strong>
        </div>
        <div>
          <span>Avg run</span>
          <strong>{averageRunPace}</strong>
        </div>
        <div>
          <span>Best protected</span>
          <strong>{bestSegment?.label ?? "Not clear"}</strong>
        </div>
      </div>
      <div className="poster-card__highlights">
        <article>
          <span>
            <TrophyIcon />
          </span>
          <div>
            <small>Best station</small>
            <strong>{bestStation?.label ?? "Not clear"}</strong>
            <em>{bestStation ? formatTime(bestStation.seconds) : "--"}</em>
          </div>
        </article>
        <article>
          <span>
            <TrophyIcon />
          </span>
          <div>
            <small>Best run</small>
            <strong>{bestRun?.label ?? "Not clear"}</strong>
            <em>{bestRun ? formatTime(bestRun.actualSeconds) : "--"}</em>
          </div>
        </article>
      </div>
      <div className="poster-card__splits">
        <span>Fastest splits</span>
        <div>
          {shareSplits.map((segment) => (
            <p key={segment.id}>
              <span>{segment.label}</span>
              <strong>{formatTime(segment.actualSeconds)}</strong>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
