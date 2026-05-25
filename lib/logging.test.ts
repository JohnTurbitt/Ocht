import { describe, expect, it } from "vitest";
import { sanitizeError } from "./logging";

describe("sanitizeError", () => {
  it("redacts sensitive object keys", () => {
    const sanitized = sanitizeError({
      email: "runner@example.com",
      password: "Password1",
      sessionToken: "raw-session-token",
      nested: {
        stripeWebhookSecret: "whsec_secret",
      },
    });

    expect(sanitized).toMatchObject({
      email: "runner@example.com",
      password: "[redacted]",
      sessionToken: "[redacted]",
      nested: {
        stripeWebhookSecret: "[redacted]",
      },
    });
  });

  it("redacts secret-like values from error messages", () => {
    const sanitized = sanitizeError(
      new Error(
        "Failed with sk_test_abc123 and postgresql://user:pass@example.com/db",
      ),
    );

    expect(sanitized).toMatchObject({
      message: "Failed with [redacted] and [redacted]example.com/db",
    });
  });
});
