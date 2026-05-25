import type { AuthUser } from "@/lib/apiClient";

type OnboardingChecklistProps = {
  user: AuthUser;
  savedReportCount: number;
  billingLoading: boolean;
  onCreateReport: () => void;
  onResendVerification: () => Promise<void>;
  onStartCheckout: () => void;
  onDismiss: () => void;
};

type OnboardingStep = {
  id: string;
  title: string;
  detail: string;
  complete: boolean;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
};

export function OnboardingChecklist({
  user,
  savedReportCount,
  billingLoading,
  onCreateReport,
  onResendVerification,
  onStartCheckout,
  onDismiss,
}: OnboardingChecklistProps) {
  const steps: OnboardingStep[] = [
    {
      id: "verify-email",
      title: "Verify email",
      detail: "Keeps password reset and account notices reliable.",
      complete: user.emailVerified,
      actionLabel: "Resend email",
      onAction: () => void onResendVerification(),
    },
    {
      id: "first-report",
      title: "Create first report",
      detail: "Save a baseline race breakdown to your account.",
      complete: savedReportCount > 0,
      actionLabel: "Create report",
      onAction: onCreateReport,
    },
    {
      id: "premium",
      title: "Unlock premium",
      detail: "Open full reports, custom formats, and premium analysis.",
      complete: user.subscription === "ACTIVE",
      actionLabel: billingLoading ? "Opening..." : "Upgrade",
      onAction: onStartCheckout,
      disabled: billingLoading,
    },
  ];
  const completedCount = steps.filter((step) => step.complete).length;

  if (completedCount === steps.length) {
    return null;
  }

  return (
    <section className="onboarding" aria-label="Account setup checklist">
      <div className="onboarding__header">
        <div>
          <p className="eyebrow">Account setup</p>
          <h2>Finish setting up Ocht</h2>
        </div>
        <div
          className="onboarding__progress"
          aria-label={`${completedCount} of ${steps.length} complete`}
        >
          <span>{completedCount}</span>/{steps.length}
        </div>
        <button
          className="onboarding__dismiss"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss setup checklist"
        >
          x
        </button>
      </div>

      <div className="onboarding__steps">
        {steps.map((step) => (
          <div
            className={
              step.complete
                ? "onboarding__step onboarding__step--complete"
                : "onboarding__step"
            }
            key={step.id}
          >
            <span className="onboarding__check" aria-hidden="true" />
            <div>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </div>
            {!step.complete && step.actionLabel && step.onAction ? (
              <button
                className="button-secondary"
                type="button"
                onClick={step.onAction}
                disabled={step.disabled}
              >
                {step.actionLabel}
              </button>
            ) : null}
            {step.complete ? (
              <span className="onboarding__done">Done</span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
