"use client";

import { useState } from "react";
import { GoalScreen } from "./GoalScreen";
import { StravaConnectScreen } from "./StravaConnectScreen";

type Step = "goal" | "strava";
type Goal = "results" | "training" | "explore";

interface Props {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState<Goal | null>(null);

  function handleGoalSelect(selected: Goal) {
    setGoal(selected);
    if (selected === "explore") {
      markComplete();
    } else {
      setStep("strava");
    }
  }

  function markComplete() {
    fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onboardingCompleted: true,
        defaultLevel: "competitive",
        defaultTargetTime: "1:25:00",
      }),
    }).catch(() => {});
    onComplete();
  }

  return (
    <div
      className="onboarding-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Ocht"
    >
      <div className="onboarding-modal">
        {step === "goal" && <GoalScreen onSelect={handleGoalSelect} />}
        {step === "strava" && goal && goal !== "explore" && (
          <StravaConnectScreen goal={goal} onSkip={markComplete} />
        )}
      </div>
    </div>
  );
}
