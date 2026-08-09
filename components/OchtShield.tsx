type OchtShieldProps = {
  size?: number;
  className?: string;
  title?: string;
};

/**
 * The Ocht "8" shield mark used on the launch splash, header, and report.
 * Fills come from CSS classes (loader-shield-body / loader-shield-glyph) so
 * the mark adapts to the active theme instead of hardcoding acid green.
 */
export function OchtShield({ size = 26, className, title }: OchtShieldProps) {
  const width = size;
  const height = Math.round((size * 78) / 64);

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 64 78"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        className="loader-shield-body"
        d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
      />
      <text
        className="loader-shield-glyph"
        x="32"
        y="56"
        textAnchor="middle"
        fontFamily="var(--font-display), sans-serif"
        fontWeight="900"
        fontSize="46"
      >
        8
      </text>
    </svg>
  );
}
