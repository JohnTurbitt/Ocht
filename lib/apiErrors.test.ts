import { describe, expect, it } from "vitest";
import { billingPortalError, checkoutError, signupError } from "./apiErrors";

describe("api error helpers", () => {
  it("explains missing Stripe checkout configuration without leaking config names", async () => {
    const response = checkoutError(
      new Error("STRIPE_PRICE_ID is not configured."),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.errors[0]).not.toContain("STRIPE_PRICE_ID");
    expect(body.errors[0]).toContain("Payment plan is not configured");
  });

  it("explains an invalid checkout price without leaking config names", async () => {
    const response = checkoutError({
      code: "resource_missing",
      param: "line_items[0][price]",
      statusCode: 400,
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0]).not.toContain("STRIPE_PRICE_ID");
    expect(body.errors[0]).toContain("Checkout could not be started");
  });

  it("explains Stripe billing portal outages", async () => {
    const response = billingPortalError({
      type: "StripeConnectionError",
      statusCode: 500,
    });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0]).toContain("Stripe billing could not be reached");
  });

  it("explains unreachable account database errors without leaking config names", async () => {
    const response = signupError(
      new Error("Can't reach database server at base"),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.errors[0]).not.toContain("DATABASE_URL");
    expect(body.errors[0]).toContain("Account service is unavailable");
  });
});
