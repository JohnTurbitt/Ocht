export const PAPER = "#08100d";
export const LIME = "#c8ff2e";
export const BADGE_INK = "#0b120f";
export const MUTED = "#adbaaa";
export const RING_LINE = "rgba(200, 255, 46, 0.4)";
export const RING_DOT_OPACITY = 0.7;

export const RING_POINTS: Array<[number, number]> = [
  [55, 5],
  [90, 18],
  [105, 55],
  [90, 92],
  [55, 105],
  [20, 92],
  [5, 55],
  [20, 18],
];

type ShieldMarkProps = {
  size: number;
  displayFontFamily: string;
  opacity?: number;
  scale?: number;
};

export function ShieldMark({
  size,
  displayFontFamily,
  opacity = 1,
  scale = 1,
}: ShieldMarkProps) {
  return (
    <svg
      width={size}
      height={Math.round((size * 78) / 64)}
      viewBox="0 0 64 78"
      fill="none"
      style={{
        opacity,
        transform: `scale(${scale})`,
        filter: `drop-shadow(0 6px 22px ${LIME}59)`,
      }}
    >
      <path
        d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
        fill={LIME}
      />
      <text
        x="32"
        y="56"
        textAnchor="middle"
        fontFamily={displayFontFamily}
        fontWeight={900}
        fontSize={46}
        fill={BADGE_INK}
      >
        8
      </text>
    </svg>
  );
}

type RingMarkProps = {
  size: number;
  opacity?: number;
  rotationDeg?: number;
};

export function RingMark({ size, opacity = 1, rotationDeg = 0 }: RingMarkProps) {
  return (
    <svg
      viewBox="0 0 110 110"
      fill="none"
      style={{
        position: "absolute",
        inset: 0,
        width: size,
        height: size,
        opacity,
        transform: `rotate(${rotationDeg}deg)`,
      }}
    >
      <polygon
        points={RING_POINTS.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={RING_LINE}
        strokeWidth={1.5}
      />
      <g>
        {RING_POINTS.map(([cx, cy]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={3}
            fill={LIME}
            opacity={RING_DOT_OPACITY}
          />
        ))}
      </g>
    </svg>
  );
}

export const LIVE_PANEL = "#0e1914";
export const RECORD_BADGE_GRADIENT =
  "radial-gradient(circle at 35% 30%, #d8ff6a, #b6ef00 60%, #94c700 100%)";
export const RECORD_BADGE_SHIELD_FILL = "rgba(14, 25, 20, 0.08)";
export const RECORD_BADGE_INK = "#0e1914";

type RecordMarkProps = {
  size: number;
  displayFontFamily: string;
  opacity?: number;
  scale?: number;
};

export function RecordMark({
  size,
  displayFontFamily,
  opacity = 1,
  scale = 1,
}: RecordMarkProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: RECORD_BADGE_GRADIENT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 64 78" fill="none">
        <path
          d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
          fill={RECORD_BADGE_SHIELD_FILL}
          stroke={RECORD_BADGE_INK}
          strokeWidth={2}
        />
        <text
          x="32"
          y="52"
          textAnchor="middle"
          fontFamily={displayFontFamily}
          fontWeight={900}
          fontSize={34}
          fill={RECORD_BADGE_INK}
        >
          8
        </text>
      </svg>
    </div>
  );
}
