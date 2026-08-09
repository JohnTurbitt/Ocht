import { describe, expect, it } from "vitest";
import {
  effectiveSubscription,
  subscriptionStatusFromStripe,
  subscriptionStatusFromStripeSubscriptions,
} from "./billing";

describe("subscriptionStatusFromStripe", () => {
  it("maps paid Stripe statuses to active access", () => {
    expect(subscriptionStatusFromStripe("active")).toBe("ACTIVE");
    expect(subscriptionStatusFromStripe("trialing")).toBe("ACTIVE");
  });

  it("maps failed payment states to past due access", () => {
    expect(subscriptionStatusFromStripe("past_due")).toBe("PAST_DUE");
    expect(subscriptionStatusFromStripe("unpaid")).toBe("PAST_DUE");
  });

  it("maps ended or incomplete subscriptions to non-paid access", () => {
    expect(subscriptionStatusFromStripe("canceled")).toBe("CANCELED");
    expect(subscriptionStatusFromStripe("incomplete_expired")).toBe("CANCELED");
    expect(subscriptionStatusFromStripe("incomplete")).toBe("FREE");
  });
});

describe("subscriptionStatusFromStripeSubscriptions", () => {
  it("prefers active access when any subscription is active", () => {
    expect(
      subscriptionStatusFromStripeSubscriptions([
        { status: "canceled" },
        { status: "active" },
      ] as never),
    ).toBe("ACTIVE");
  });

  it("detects past due subscriptions without active access", () => {
    expect(
      subscriptionStatusFromStripeSubscriptions([
        { status: "past_due" },
      ] as never),
    ).toBe("PAST_DUE");
  });

  it("falls back to free when no billable subscription exists", () => {
    expect(subscriptionStatusFromStripeSubscriptions([])).toBe("FREE");
  });
});

describe("effectiveSubscription", () => {
  it("grants active access when the override is COMP, regardless of Stripe status", () => {
    expect(
      effectiveSubscription({ subscription: "FREE", subscriptionOverride: "COMP" }),
    ).toBe("ACTIVE");
    expect(
      effectiveSubscription({ subscription: "CANCELED", subscriptionOverride: "COMP" }),
    ).toBe("ACTIVE");
  });

  it("forces free access when the override is DISABLED, regardless of Stripe status", () => {
    expect(
      effectiveSubscription({ subscription: "ACTIVE", subscriptionOverride: "DISABLED" }),
    ).toBe("FREE");
    expect(
      effectiveSubscription({ subscription: "PAST_DUE", subscriptionOverride: "DISABLED" }),
    ).toBe("FREE");
  });

  it("passes through the Stripe-driven status when there is no override", () => {
    for (const status of ["FREE", "ACTIVE", "PAST_DUE", "CANCELED"] as const) {
      expect(
        effectiveSubscription({ subscription: status, subscriptionOverride: null }),
      ).toBe(status);
    }
  });
});
