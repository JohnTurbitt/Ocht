"use client";

import { RefObject, useId } from "react";
import { Analysis, formatTime } from "@/lib/analysis";
import { AvatarMark } from "./AvatarMark";
import { OchtShield } from "./OchtShield";

type ShareCardProps = {
  analysis: Analysis;
  generatedDate: string;
  athleteName?: string;
  avatarColor?: string;
  avatarIcon?: string;
  captureRef?: RefObject<HTMLDivElement | null>;
};

function CardHeader({
  generatedDate,
  athleteName,
  avatarColor,
  avatarIcon,
}: {
  generatedDate: string;
  athleteName?: string;
  avatarColor?: string;
  avatarIcon?: string;
}) {
  const initial = athleteName?.trim().charAt(0).toUpperCase() || "";

  return (
    <div className="share-card__top">
      <div className="share-card__brand">
        <OchtShield size={34} />
        <span className="share-card__wordmark">
          ocht<em>.</em>
        </span>
      </div>
      {athleteName ? (
        <div className="share-card__athlete">
          <span
            className="share-card__avatar"
            style={{ background: avatarColor }}
          >
            <AvatarMark icon={avatarIcon ?? "initial"} initial={initial} />
          </span>
          <span className="share-card__athlete-meta">
            <strong>{athleteName}</strong>
            <span>{generatedDate || "Ocht"}</span>
          </span>
        </div>
      ) : (
        <span className="share-card__date">{generatedDate || "Ocht"}</span>
      )}
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
  athleteName,
  avatarColor,
  avatarIcon,
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
      <CardHeader
        generatedDate={generatedDate}
        athleteName={athleteName}
        avatarColor={avatarColor}
        avatarIcon={avatarIcon}
      />
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
  athleteName,
  avatarColor,
  avatarIcon,
  captureRef,
}: ShareCardProps) {
  const { archetype } = analysis;

  return (
    <div className="share-card share-card--archetype" ref={captureRef}>
      <CardHeader
        generatedDate={generatedDate}
        athleteName={athleteName}
        avatarColor={avatarColor}
        avatarIcon={avatarIcon}
      />
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

type StoryPRRow = {
  label: string;
  time: string;
  isNew: boolean;
};

type ShareStoryCardProps = {
  score: number;
  tierLabel: string;
  athleteName?: string;
  eventDate: string;
  prRows: StoryPRRow[];
  captureRef?: RefObject<HTMLDivElement | null>;
};

export function ShareStoryCard({ score, tierLabel, athleteName, eventDate, prRows, captureRef }: ShareStoryCardProps) {
  const glowId = useId();
  const octPts = "30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30";
  return (
    <div className="share-card share-card--story" ref={captureRef}>
      <div className="share-card__story-brand">
        <OchtShield size={34} />
        <span className="share-card__wordmark">ocht<em>.</em></span>
      </div>
      <div className="share-card__story-octagon">
        <svg width="360" height="360" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <polygon points={octPts} fill="none" stroke="#C8FF2E" strokeWidth="2" filter={`url(#${glowId})`} />
          <text x="50" y="46" textAnchor="middle" fontSize="28" fontWeight="900" fill="#C8FF2E" fontFamily="var(--font-display),sans-serif">{score}</text>
          <text x="50" y="62" textAnchor="middle" fontSize="9" fill="#e8e8e8" fontFamily="var(--font-display),sans-serif" fontWeight="700">{tierLabel.toUpperCase()}</text>
        </svg>
      </div>
      {athleteName && <p className="share-card__story-athlete">{athleteName}</p>}
      <p className="share-card__story-date">{eventDate}</p>
      {prRows.length > 0 && (
        <div className="share-card__pr-table">
          <p className="share-card__pr-table-title">Personal Records</p>
          {prRows.map((row) => (
            <div key={row.label} className="share-card__pr-row">
              <span className="share-card__pr-station">{row.label}</span>
              <span className="share-card__pr-time">{row.time}</span>
              {row.isNew && <span className="share-card__pr-badge">PR</span>}
            </div>
          ))}
        </div>
      )}
      <span className="share-card__story-handle">ocht.app</span>
    </div>
  );
}
