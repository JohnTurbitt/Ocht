type OctagonSpinnerProps = {
  size?: number;
  label?: string;
  className?: string;
};

const OCTAGON_POINTS = "20,2 31,6 38,14 38,26 31,34 20,38 9,34 2,26 2,14 9,6";

/**
 * Inline octagon spinner that inherits the surrounding text color via
 * `currentColor`, so it reads correctly inside both dark and light buttons.
 */
export function OctagonSpinner({
  size = 18,
  label,
  className,
}: OctagonSpinnerProps) {
  return (
    <svg
      className={
        className ? `octagon-spinner ${className}` : "octagon-spinner"
      }
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role={label ? "img" : "presentation"}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polygon
        className="octagon-spinner__track"
        points={OCTAGON_POINTS}
        strokeWidth={2}
      />
      <polygon
        className="octagon-spinner__head"
        points={OCTAGON_POINTS}
        strokeWidth={2}
        strokeDasharray="8 88"
        strokeLinecap="round"
      />
    </svg>
  );
}
