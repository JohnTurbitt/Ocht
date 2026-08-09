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
