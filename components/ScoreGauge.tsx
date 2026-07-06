"use client";

type ScoreGaugeProps = {
  score: number;
  label: string;
  size?: number;
};

function tierFor(score: number): { cls: string; label: string } {
  if (score >= 70) return { cls: "high", label: "Elite" };
  if (score >= 45) return { cls: "mid", label: "Pro" };
  return { cls: "low", label: "Finisher" };
}

export function ScoreGauge({ score, label, size = 160 }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const { cls, label: tierLabel } = tierFor(clamped);
  const pts = "48,6 112,6 154,48 154,112 112,154 48,154 6,112 6,48";
  const fillH = Math.round(148 * (clamped / 100));
  const fillY = 6 + (148 - fillH);

  return (
    <div className={`score-gauge score-gauge--octagon score-gauge--${cls}`}>
      <svg width={size} height={size} viewBox="0 0 160 160" aria-hidden="true">
        <defs>
          <clipPath id="oct-clip">
            <polygon points={pts} />
          </clipPath>
        </defs>
        <polygon points={pts} className="score-gauge__shell" fill="none" />
        <rect x="0" y={fillY} width="160" height={fillH} className="score-gauge__fill" clipPath="url(#oct-clip)" />
        <rect x="0" y={fillY} width="160" height="3" className="score-gauge__waterline" clipPath="url(#oct-clip)" />
        <text x="80" y="84" textAnchor="middle" className="score-gauge__tier-name" fontFamily="var(--font-display), sans-serif" fontWeight="900">{tierLabel}</text>
        <text x="80" y="104" textAnchor="middle" className="score-gauge__score-line" fontFamily="var(--font-display), sans-serif" fontWeight="700">{clamped} / 100</text>
        <text x="80" y="120" textAnchor="middle" className="score-gauge__label-text" fontFamily="var(--font-body), sans-serif">{label.toUpperCase()}</text>
      </svg>
    </div>
  );
}
