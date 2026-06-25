const SHIELD_PATH = "M28 2L54 14V40C54 53 28 66 28 66C28 66 2 53 2 40V14L28 2Z";

const RANK_COLORS = {
  1: { dots: "#f5c518", shield: "#f5c518" },
  2: { dots: "#b8bec7", shield: "#b8bec7" },
  3: { dots: "#c87533", shield: "#c87533" },
} as const;

const RANK_LABELS = { 1: "1st", 2: "2nd", 3: "3rd" } as const;

type Rank = 1 | 2 | 3;

const ORBIT_R = 66;
// 8 dots at 45° intervals, starting from the top (−90° offset)
const DOTS = Array.from({ length: 8 }, (_, i) => {
  const rad = ((i * 45 - 90) * Math.PI) / 180;
  return { cx: 80 + ORBIT_R * Math.cos(rad), cy: 80 + ORBIT_R * Math.sin(rad) };
});

export function PBTrophyBadge({ rank = 1 as Rank, size = 80 }: { rank?: Rank; size?: number }) {
  const { dots: dotsColor, shield: shieldColor } = RANK_COLORS[rank];
  const shieldSize = Math.round(size * 0.52);

  return (
    <div className="pb-trophy-badge" style={{ width: size, height: size }} aria-hidden="true">

      {/* Outer ring SVG — static, just holds the orbiting dots group */}
      <svg width={size} height={size} viewBox="0 0 160 160">
        {/* Faint orbit track */}
        <circle
          cx="80" cy="80" r={ORBIT_R}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.12"
        />
        {/* Orbiting dots — rotate inner <g> to avoid vibration.
            transform-box:view-box pins origin to SVG viewport centre (80,80). */}
        <g className="pb-trophy-badge__dots">
          {DOTS.map(({ cx, cy }, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={i === 0 ? 6 : 4}
              fill={dotsColor}
              opacity={+(1 - i * 0.1).toFixed(2)}
            />
          ))}
        </g>
      </svg>

      {/* Ocht shield centred, does not rotate */}
      <svg
        className="pb-trophy-badge__icon"
        viewBox="0 0 56 68"
        width={shieldSize}
        height={shieldSize}
        fill="none"
        aria-hidden="true"
      >
        <path d={SHIELD_PATH} fill={shieldColor} />
        <text
          x="28"
          y="43"
          textAnchor="middle"
          fontFamily="var(--font-display), sans-serif"
          fontWeight="900"
          fontSize="16"
          fill="#0d1410"
        >
          {RANK_LABELS[rank]}
        </text>
      </svg>

    </div>
  );
}
