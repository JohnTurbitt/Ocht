// Shared confirm dialog for the dedicated live tap-to-lap pages (setup +
// tracker) — replaces window.confirm/alert so these prompts match the
// dark acid-green live theme instead of the browser's native chrome.
// Used by LiveSessionTracker (stop session) and app/app/live/page.tsx
// (resume an unfinished session).

type LiveConfirmModalProps = {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
};

export function LiveConfirmModal({
  title,
  body,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: LiveConfirmModalProps) {
  return (
    <>
      <div className="live-confirm-backdrop" aria-hidden="true" />
      <div
        className="live-confirm"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <p className="live-confirm__title">{title}</p>
        <p className="live-confirm__body">{body}</p>
        <div className="live-confirm__actions">
          <button
            type="button"
            className="live-confirm__primary"
            onClick={onPrimary}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            className="live-confirm__secondary"
            onClick={onSecondary}
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </>
  );
}
