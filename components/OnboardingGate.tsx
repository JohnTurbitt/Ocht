"use client";

import { useEffect, useState } from "react";
import { OnboardingModal } from "./onboarding/OnboardingModal";

export function OnboardingGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("ocht.onboardingCompleted") === "true") return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user && !data.user.onboardingCompletedAt) {
          setShow(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!show) return null;
  return <OnboardingModal onComplete={() => setShow(false)} />;
}
