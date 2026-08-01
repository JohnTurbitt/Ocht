"use client";

import { useEffect } from "react";

export function PremiumTierGate() {
  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;

        document.documentElement.dataset.tier =
          data.user?.subscription === "ACTIVE" ? "premium" : "free";
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
