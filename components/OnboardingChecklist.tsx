import { useState } from "react";
import type { AuthUser } from "@/lib/apiClient";
import { PREMIUM_SELF_SERVE_ENABLED } from "@/lib/featureFlags";
import { persistPremiumStepSkipped, readPremiumStepSkipped } from "@/lib/preferences";

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
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
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
  const [premiumSkipped, setPremiumSkipped] = useState(() =>
    readPremiumStepSkipped(user.id),
  );

  function skipPremiumStep() {
    persistPremiumStepSkipped(user.id);
    setPremiumSkipped(true);
  }

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
    PREMIUM_SELF_SERVE_ENABLED
      ? {
          id: "premium",
          title: "Unlock premium",
          detail: "Open full reports, custom formats and premium analysis.",
          complete: user.subscription === "ACTIVE" || premiumSkipped,
          actionLabel: billingLoading ? "Opening..." : "Upgrade",
          onAction: onStartCheckout,
          disabled: billingLoading,
          secondaryActionLabel: "Later",
          onSecondaryAction: skipPremiumStep,
        }
      : {
          id: "premium",
          title: "Unlock premium",
          detail:
            "Premium is beta testers only right now — email support@ocht.app for early access.",
          complete: user.subscription === "ACTIVE" || premiumSkipped,
          secondaryActionLabel: "Later",
          onSecondaryAction: skipPremiumStep,
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
            {!step.complete && (step.actionLabel || step.secondaryActionLabel) ? (
              <div className="onboarding__step-actions">
                {step.actionLabel && step.onAction ? (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={step.onAction}
                    disabled={step.disabled}
                  >
                    {step.actionLabel}
                  </button>
                ) : null}
                {step.secondaryActionLabel && step.onSecondaryAction ? (
                  <button
                    className="onboarding__step-later"
                    type="button"
                    onClick={step.onSecondaryAction}
                  >
                    {step.secondaryActionLabel}
                  </button>
                ) : null}
              </div>
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
