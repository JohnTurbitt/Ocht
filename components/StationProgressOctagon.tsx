type StationProgressOctagonProps = {
  doneCount: number; // 0-8 stations completed
  inProgress: boolean; // is a station currently underway (the (doneCount+1)th side pulses)
  size?: number;
};

const STATION_COUNT = 8;

function polarPoint(cx: number, cy: number, r: number, index: number, count: number) {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2 - Math.PI / count;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
}

export function StationProgressOctagon({
  doneCount,
  inProgress,
  size = 60,
}: StationProgressOctagonProps) {
  const cx = 50;
  const cy = 50;
  const r = 38;
  const points = Array.from({ length: STATION_COUNT }, (_, i) =>
    polarPoint(cx, cy, r, i, STATION_COUNT),
  );
  const fillPoints = points.map(([x, y]) => `${x},${y}`).join(" ");
  const glowId = "station-octagon-glow";

  const shieldW = 30;
  const shieldH = (shieldW * 78) / 64;
  const allDone = doneCount >= STATION_COUNT;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${Math.min(doneCount, STATION_COUNT)} of ${STATION_COUNT} stations complete`}
    >
      <defs>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon points={fillPoints} fill="#0f1913" stroke="none" />
      <polygon points={fillPoints} fill="none" stroke="#20302a" strokeWidth={2.5} />

      {points.map(([x1, y1], i) => {
        const [x2, y2] = points[(i + 1) % STATION_COUNT];
        const done = allDone || i < doneCount;
        const current = !allDone && i === doneCount && inProgress;

        if (!done && !current) {
          return null;
        }

        return (
          <line
            key={`side-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#c8ff2e"
            strokeWidth={4.5}
            strokeLinecap="round"
            filter={current ? `url(#${glowId})` : undefined}
            className={current ? "station-octagon__pulse" : undefined}
          />
        );
      })}

      {points.map(([x, y], i) => {
        const lit =
          allDone ||
          i < doneCount ||
          (i === doneCount && inProgress) ||
          ((i - 1 + STATION_COUNT) % STATION_COUNT === doneCount && inProgress);

        return (
          <circle
            key={`dot-${i}`}
            cx={x}
            cy={y}
            r={2.2}
            fill={lit ? "#c8ff2e" : "#20302a"}
          />
        );
      })}

      <g transform={`translate(${cx - shieldW / 2}, ${cy - shieldH / 2})`}>
        <path
          d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
          transform={`scale(${shieldW / 64})`}
          fill="rgba(200,255,46,0.06)"
          stroke="#4a5c52"
          strokeWidth={2}
        />
        <text
          x={shieldW / 2}
          y={shieldH * 0.74}
          textAnchor="middle"
          fontFamily="var(--font-display), sans-serif"
          fontWeight={900}
          fontSize={shieldH * 0.62}
          fill="#c8ff2e"
        >
          8
        </text>
      </g>
    </svg>
  );
}
