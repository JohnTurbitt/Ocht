import { OchtShield } from "./OchtShield";

type PremiumBadgeProps = {
  label?: string;
};

export function PremiumBadge({ label = "Ocht premium" }: PremiumBadgeProps) {
  return (
    <span className="premium-badge" aria-label={label} title={label}>
      <OchtShield size={15} />
    </span>
  );
}
