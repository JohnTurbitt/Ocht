import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCurrentUser } from "@/lib/apiAuth";
import { getStripe } from "@/lib/billing";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { sessionCookieName } from "@/lib/session";
import { DELETE } from "./route";

vi.mock("@/lib/session", () => ({
  sessionCookieName: "ocht_session",
}));

vi.mock("@/lib/apiAuth", () => ({
  getCurrentUser: vi.fn(),
  requireCurrentUser: vi.fn(),
}));

vi.mock("@/lib/apiValidation", () => ({
  validateProfilePayload: vi.fn(),
}));

vi.mock("@/lib/profile", () => ({
  athleteLevelByLevel: {},
  toPublicUser: vi.fn(),
}));

vi.mock("@/lib/billing", () => ({
  getStripe: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  logServerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/security", () => ({
  guardBrowserMutation: vi.fn(() => null),
}));

function deleteRequest() {
  return new NextRequest("http://localhost/api/auth/me", { method: "DELETE" });
}

const testUser = {
  id: "user_1",
  email: "runner@example.com",
  emailVerified: true,
  name: "Test Runner",
  subscription: "ACTIVE" as const,
  defaultLevel: "competitive" as const,
  defaultTargetTime: "1:25:00",
  onboardingCompletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.mocked(guardBrowserMutation).mockReturnValue(null);
  vi.mocked(requireCurrentUser).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.delete).mockReset();
  vi.mocked(getStripe).mockReset();
  vi.mocked(logServerError).mockClear();
});

describe("DELETE /api/auth/me", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(null);

    const response = await DELETE(deleteRequest());

    expect(response.status).toBe(401);
  });

  it("returns the guard response when rate limited", async () => {
    const guardResponse = NextResponse.json(
      { errors: ["Too many requests."] },
      { status: 429 },
    );
    vi.mocked(guardBrowserMutation).mockReturnValue(guardResponse);

    const response = await DELETE(deleteRequest());

    expect(response).toBe(guardResponse);
    expect(requireCurrentUser).not.toHaveBeenCalled();
  });

  it("cancels active Stripe subscriptions and deletes the account", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_123",
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

    const cancel = vi.fn().mockResolvedValue({});
    const list = vi.fn().mockResolvedValue({
      data: [
        { id: "sub_active", status: "active" },
        { id: "sub_canceled", status: "canceled" },
      ],
    });
    vi.mocked(getStripe).mockReturnValue({
      subscriptions: { list, cancel },
    } as never);

    const response = await DELETE(deleteRequest());

    expect(cancel).toHaveBeenCalledWith("sub_active");
    expect(cancel).not.toHaveBeenCalledWith("sub_canceled");
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: testUser.id } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.cookies.get(sessionCookieName)?.value).toBe("");
  });

  it("deletes the account without calling Stripe when no customer id is set", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: null,
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

    const response = await DELETE(deleteRequest());

    expect(getStripe).not.toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: testUser.id } });
    expect(response.status).toBe(200);
  });

  it("still deletes the account when Stripe cancellation fails", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: "cus_123",
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({} as never);
    vi.mocked(getStripe).mockReturnValue({
      subscriptions: {
        list: vi.fn().mockRejectedValue(new Error("Stripe is down")),
        cancel: vi.fn(),
      },
    } as never);

    const response = await DELETE(deleteRequest());

    expect(logServerError).toHaveBeenCalledWith(
      "Stripe subscription cancellation failed during account deletion",
      expect.any(Error),
    );
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: testUser.id } });
    expect(response.status).toBe(200);
  });

  it("returns 500 when the account cannot be deleted", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: null,
    } as never);
    vi.mocked(prisma.user.delete).mockRejectedValue(new Error("DB is down"));

    const response = await DELETE(deleteRequest());

    expect(response.status).toBe(500);
    expect(logServerError).toHaveBeenCalledWith(
      "Account deletion failed",
      expect.any(Error),
    );
  });
});
