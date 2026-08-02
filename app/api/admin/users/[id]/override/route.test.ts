import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/lib/apiAuth";
import { applyAdminOverride, loadAdminUserDetail } from "@/lib/adminUsers";
import { validateAdminOverridePayload } from "@/lib/apiValidation";
import { guardBrowserMutation } from "@/lib/security";
import { POST } from "./route";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/adminUsers", () => ({
  applyAdminOverride: vi.fn(),
  loadAdminUserDetail: vi.fn(),
}));

vi.mock("@/lib/apiValidation", () => ({
  validateAdminOverridePayload: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  guardBrowserMutation: vi.fn(() => Promise.resolve(null)),
}));

const context = { params: Promise.resolve({ id: "user_1" }) };

function overrideRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/users/user_1/override", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sampleDetail = {
  id: "user_1",
  email: "jane@example.com",
  name: "Jane Doe",
  subscription: "ACTIVE",
  stripeSubscription: "FREE",
  subscriptionOverride: "COMP",
  stripeCustomerId: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  emailVerified: true,
  onboardingCompleted: true,
  strava: null,
  reportCount: 0,
  lastReportAt: null,
  actions: [],
} as const;

beforeEach(() => {
  vi.mocked(guardBrowserMutation).mockResolvedValue(null);
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(loadAdminUserDetail).mockReset();
  vi.mocked(applyAdminOverride).mockReset();
  vi.mocked(validateAdminOverridePayload).mockReset();
});

describe("POST /api/admin/users/[id]/override", () => {
  it("returns 404 when the caller is not an admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);

    const response = await POST(overrideRequest({}), context);

    expect(response.status).toBe(404);
    expect(applyAdminOverride).not.toHaveBeenCalled();
  });

  it("returns the guard response when rate limited", async () => {
    const guardResponse = NextResponse.json({ errors: ["Too many requests."] }, { status: 429 });
    vi.mocked(guardBrowserMutation).mockResolvedValue(guardResponse);

    const response = await POST(overrideRequest({}), context);

    expect(response).toBe(guardResponse);
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user does not exist", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin_1" });
    vi.mocked(loadAdminUserDetail).mockResolvedValue(null);

    const response = await POST(overrideRequest({}), context);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ errors: ["User not found."] });
    expect(applyAdminOverride).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid payload", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin_1" });
    vi.mocked(loadAdminUserDetail).mockResolvedValue(sampleDetail as never);
    vi.mocked(validateAdminOverridePayload).mockReturnValue({
      valid: false,
      errors: ["A reason is required."],
    });

    const response = await POST(overrideRequest({ action: "GRANT_COMP", reason: "" }), context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ errors: ["A reason is required."] });
    expect(applyAdminOverride).not.toHaveBeenCalled();
  });

  it("applies the override and returns refreshed detail for a valid request", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin_1" });
    vi.mocked(loadAdminUserDetail).mockResolvedValue(sampleDetail as never);
    vi.mocked(validateAdminOverridePayload).mockReturnValue({
      valid: true,
      errors: [],
      value: { action: "GRANT_COMP", reason: "beta tester" },
    });
    vi.mocked(applyAdminOverride).mockResolvedValue(sampleDetail as never);

    const response = await POST(
      overrideRequest({ action: "GRANT_COMP", reason: "beta tester" }),
      context,
    );

    expect(applyAdminOverride).toHaveBeenCalledWith({
      adminId: "admin_1",
      targetUserId: "user_1",
      action: "GRANT_COMP",
      reason: "beta tester",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: sampleDetail });
  });
});
