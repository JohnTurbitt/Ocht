"use client";

import { CountUp } from "./CountUp";

type ScoreGaugeProps = {
  score: number;
  label: string;
  size?: number;
};

function tierFor(score: number) {
  if (score >= 70) {
    return "high";
  }

  if (score >= 45) {
    return "mid";
  }

  return "low";
}

export function ScoreGauge({ score, label, size = 132 }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <div className="score-gauge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="score-gauge__track"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className={`score-gauge__arc score-gauge__arc--${tierFor(clamped)}`}
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="score-gauge__center">
        <CountUp className="score-gauge__num" value={clamped} />
        <span className="score-gauge__denom">/100</span>
      </div>
      <span className="score-gauge__label">{label}</span>
    </div>
  );
}
