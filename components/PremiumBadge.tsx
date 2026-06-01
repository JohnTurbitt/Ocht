type PremiumBadgeProps = {
  label?: string;
};

export function PremiumBadge({ label = "Ocht premium" }: PremiumBadgeProps) {
  return (
    <span className="premium-badge" aria-label={label} title={label}>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
        <path d="m12 4.8 2.1 4.35 4.8.7-3.48 3.38.82 4.77L12 15.75 7.76 18l.82-4.77L5.1 9.85l4.8-.7L12 4.8Z" />
      </svg>
    </span>
  );
}
