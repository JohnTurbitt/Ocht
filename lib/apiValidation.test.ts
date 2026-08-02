import { describe, expect, it } from "vitest";
import {
  validateAdminOverridePayload,
  validateAuthPayload,
  validateProfilePayload,
} from "./apiValidation";

describe("validateAuthPayload", () => {
  it("normalizes valid auth payloads", () => {
    const result = validateAuthPayload({
      email: " athlete@example.com ",
      password: "password123",
      name: " Runner ",
    });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      email: "athlete@example.com",
      password: "password123",
      name: "Runner",
    });
  });

  it("rejects bad emails and short passwords", () => {
    const result = validateAuthPayload({
      email: "not-an-email",
      password: "short",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "Enter a valid email address.",
      "Password must be at least 8 characters.",
    ]);
  });
});

describe("validateProfilePayload", () => {
  it("normalizes valid profile defaults", () => {
    const result = validateProfilePayload({
      name: " Runner ",
      defaultLevel: "elite",
      defaultTargetTime: "1:18:00",
    });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      name: "Runner",
      defaultLevel: "elite",
      defaultTargetTime: "1:18:00",
    });
  });

  it("rejects invalid profile defaults", () => {
    const result = validateProfilePayload({
      name: "x".repeat(81),
      defaultLevel: "pro",
      defaultTargetTime: "1:99:00",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "Name must be 80 characters or fewer.",
      "Choose a valid default athlete level.",
      "Enter a valid default target time, for example 1:25:00.",
    ]);
  });
});

describe("validateAdminOverridePayload", () => {
  it("normalizes a valid override payload", () => {
    const result = validateAdminOverridePayload({
      action: "GRANT_COMP",
      reason: "  beta tester  ",
    });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      action: "GRANT_COMP",
      reason: "beta tester",
    });
  });

  it("rejects an invalid action", () => {
    const result = validateAdminOverridePayload({
      action: "DELETE_USER",
      reason: "not a real action",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["Choose a valid override action."]);
  });

  it("rejects a blank reason", () => {
    const result = validateAdminOverridePayload({
      action: "DISABLE",
      reason: "   ",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["A reason is required."]);
  });

  it("reports both errors when action and reason are both invalid", () => {
    const result = validateAdminOverridePayload({});

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "Choose a valid override action.",
      "A reason is required.",
    ]);
  });
});
