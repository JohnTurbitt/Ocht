export const AVATAR_ICONS: { id: string; label: string }[] = [
  { id: "initial", label: "Initial" },
  { id: "bolt", label: "Power" },
  { id: "pulse", label: "Engine" },
  { id: "flame", label: "Burn" },
  { id: "dumbbell", label: "Strength" },
  { id: "target", label: "Target" },
  { id: "shield", label: "Shield" },
];

type AvatarMarkProps = {
  icon: string;
  initial: string;
};

function iconNodes(icon: string) {
  switch (icon) {
    case "bolt":
      return <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />;
    case "pulse":
      return <path d="M3 12h4l2 6 4-13 2.5 7H21" />;
    case "flame":
      return (
        <path d="M12 3c1.2 3 4 4.2 4 8a4 4 0 0 1-8 0c0-1.2.5-2.2 1.3-3C9 11 9.6 7 12 3z" />
      );
    case "dumbbell":
      return (
        <>
          <path d="M6.5 7v10M3.5 9v6M17.5 7v10M20.5 9v6" />
          <path d="M7 12h10" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3.5" />
        </>
      );
    case "shield":
      return <path d="M12 3l7 3v5c0 4.2-3 6.8-7 8.2C8 17.8 5 15.2 5 11V6l7-3z" />;
    default:
      return null;
  }
}

// Renders either the user's initial or a chosen glyph, inheriting colour from
// the avatar (so it works in the header avatar, the menu, and share cards).
export function AvatarMark({ icon, initial }: AvatarMarkProps) {
  const nodes = iconNodes(icon);

  if (icon === "initial" || !nodes) {
    return <>{initial}</>;
  }

  return (
    <svg
      className="avatar-mark"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {nodes}
    </svg>
  );
}
