import Stripe from "stripe";

export type SubscriptionStatus = "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED";

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(secretKey);
}

export function getCheckoutPriceId() {
  const priceId =
    process.env.STRIPE_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID is not configured.");
  }

  return priceId;
}

export function subscriptionStatusFromStripe(
  status: Stripe.Subscription.Status,
): SubscriptionStatus {
  if (status === "active" || status === "trialing") {
    return "ACTIVE";
  }

  if (status === "past_due" || status === "unpaid") {
    return "PAST_DUE";
  }

  if (status === "canceled" || status === "incomplete_expired") {
    return "CANCELED";
  }

  return "FREE";
}

export function subscriptionStatusFromStripeSubscriptions(
  subscriptions: Stripe.Subscription[],
): SubscriptionStatus {
  if (
    subscriptions.some((subscription) =>
      subscription.status === "active" || subscription.status === "trialing",
    )
  ) {
    return "ACTIVE";
  }

  if (
    subscriptions.some((subscription) =>
      subscription.status === "past_due" || subscription.status === "unpaid",
    )
  ) {
    return "PAST_DUE";
  }

  if (
    subscriptions.some((subscription) =>
      subscription.status === "canceled" ||
      subscription.status === "incomplete_expired",
    )
  ) {
    return "CANCELED";
  }

  return "FREE";
}
