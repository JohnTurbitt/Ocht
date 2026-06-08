import { RefObject } from "react";
import { Analysis, formatTime } from "@/lib/analysis";
import { OchtShield } from "./OchtShield";

type ShareCardProps = {
  analysis: Analysis;
  generatedDate: string;
  captureRef?: RefObject<HTMLDivElement | null>;
};

function CardHeader({ generatedDate }: { generatedDate: string }) {
  return (
    <div className="share-card__top">
      <div className="share-card__brand">
        <OchtShield size={34} />
        <span className="share-card__wordmark">
          ocht<em>.</em>
        </span>
      </div>
      <span className="share-card__date">{generatedDate || "Ocht"}</span>
    </div>
  );
}

function CardFooter({ analysis }: { analysis: Analysis }) {
  return (
    <div className="share-card__foot">
      <span>
        {analysis.raceFormat.toUpperCase()} · {analysis.levelLabel}
      </span>
      <span className="share-card__handle">ocht.app</span>
    </div>
  );
}

export function ShareFinishCard({
  analysis,
  generatedDate,
  captureRef,
}: ShareCardProps) {
  const hasTarget = analysis.targetSeconds > 0;
  const delta =
    hasTarget && analysis.targetGapSeconds > 0
      ? {
          tone: "over" as const,
          text: `+${formatTime(analysis.targetGapSeconds)} vs target`,
        }
      : hasTarget
        ? { tone: "under" as const, text: "On target" }
        : {
            tone: "under" as const,
            text: `Next step ${formatTime(analysis.predictedTargetSeconds)}`,
          };

  const kpis = [
    { label: "Avg run", value: analysis.averageRunPace },
    { label: "Realistic gain", value: formatTime(analysis.recoverableSeconds) },
    {
      label: "Biggest leak",
      value: analysis.topLeaks[0]?.label ?? "Balanced",
    },
  ];

  return (
    <div className="share-card share-card--finish" ref={captureRef}>
      <CardHeader generatedDate={generatedDate} />
      <div className="share-card__body">
        <p className="share-card__eyebrow">Projected finish</p>
        <div className="share-card__finish">{formatTime(analysis.finishSeconds)}</div>
        <div className={`share-card__delta share-card__delta--${delta.tone}`}>
          {delta.text}
        </div>
      </div>
      <div className="share-card__kpis">
        {kpis.map((kpi) => (
          <div className="share-card__kpi" key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
          </div>
        ))}
      </div>
      <CardFooter analysis={analysis} />
    </div>
  );
}

const SCORE_ROWS: {
  key: keyof Analysis["archetype"]["scores"];
  label: string;
}[] = [
  { key: "engine", label: "Run engine" },
  { key: "strength", label: "Strength" },
  { key: "durability", label: "Durability" },
  { key: "consistency", label: "Consistency" },
];

export function ShareArchetypeCard({
  analysis,
  generatedDate,
  captureRef,
}: ShareCardProps) {
  const { archetype } = analysis;

  return (
    <div className="share-card share-card--archetype" ref={captureRef}>
      <CardHeader generatedDate={generatedDate} />
      <div className="share-card__body">
        <p className="share-card__eyebrow">Athlete archetype</p>
        <div className="share-card__archetype">{archetype.label}</div>
        <p className="share-card__tagline">{archetype.tagline}</p>
      </div>
      <div className="share-card__bars">
        {SCORE_ROWS.map(({ key, label }) => {
          const score = archetype.scores[key];
          const tier = score >= 75 ? "high" : score >= 50 ? "mid" : "low";

          return (
            <div className="share-card__bar" key={key}>
              <div className="share-card__bar-head">
                <span>{label}</span>
                <strong>{score}</strong>
              </div>
              <div className="share-card__bar-track">
                <div
                  className={`share-card__bar-fill share-card__bar-fill--${tier}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="share-card__finish-line">
        Projected finish
        <strong>{formatTime(analysis.finishSeconds)}</strong>
      </div>
      <CardFooter analysis={analysis} />
    </div>
  );
}
