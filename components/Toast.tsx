export type ToastTone = "error" | "success";

export type ToastMessage = {
  id: number;
  title: string;
  message: string;
  tone: ToastTone;
};

type ToastProps = {
  toast: ToastMessage | null;
  onDismiss: () => void;
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {tone === "success" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5v.5" />
        </>
      )}
    </svg>
  );
}

export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <div
      className={`toast toast--${toast.tone}`}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
    >
      <span className="toast__icon" aria-hidden="true">
        <ToastIcon tone={toast.tone} />
      </span>
      <div className="toast__body">
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button
        className="toast__close modal-close"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>
  );
}
