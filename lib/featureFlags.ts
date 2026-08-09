// Self-serve Stripe checkout is off by default so the paywall never shows a
// real checkout button while live Stripe keys aren't configured yet. Set
// NEXT_PUBLIC_PREMIUM_SELF_SERVE_ENABLED=true once ready to accept real
// payments. Until then, premium access is granted manually via /admin.
export const PREMIUM_SELF_SERVE_ENABLED =
  process.env.NEXT_PUBLIC_PREMIUM_SELF_SERVE_ENABLED === "true";
