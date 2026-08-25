/**
 * The shield mark on a solid lime circle — used for the "Record live" nav
 * entry point (the raised mobile bottom-nav button and the desktop tab-row
 * pill; see docs/superpowers/specs/2026-08-24-nav-redesign.md). Renders its
 * own copy of the shield path with inverted (dark-on-lime) coloring, since
 * OchtShield's fills are hardcoded to brand lime for the opposite case (a
 * lime shield on a dark background) — the same kind of duplication
 * ReportGenerationOverlay's ring already uses, for the same reason.
 *
 * Sizing is controlled entirely by the wrapping element's CSS (width/height
 * on `.record-badge`), not a prop — it renders at two very different sizes
 * depending on breakpoint, and CSS is what actually varies there.
 */
export function RecordBadge({ className }: { className?: string }) {
  return (
    <span
      className={className ? `record-badge ${className}` : "record-badge"}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 78" className="record-badge__icon">
        <path
          className="record-badge__shield"
          d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
        />
        <text
          className="record-badge__glyph"
          x="32"
          y="52"
          textAnchor="middle"
          fontFamily="var(--font-display), sans-serif"
          fontWeight="900"
          fontSize="34"
        >
          8
        </text>
      </svg>
    </span>
  );
}
