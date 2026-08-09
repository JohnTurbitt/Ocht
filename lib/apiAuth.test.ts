import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import { getCurrentUser, requireAdmin } from "./apiAuth";

vi.mock("./prisma", () => ({
  prisma: {
    userSession: {
      findUnique: vi.fn(),
    },
  },
}));

function requestWithSession(token?: string) {
  return new NextRequest("http://localhost/api/admin/users", {
    headers: token ? { cookie: `ocht_session=${token}` } : undefined,
  });
}

beforeEach(() => {
  vi.mocked(prisma.userSession.findUnique).mockReset();
});

describe("requireAdmin", () => {
  it("returns null when there is no session cookie", async () => {
    const admin = await requireAdmin(requestWithSession());

    expect(admin).toBeNull();
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the session is expired", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
      user: { id: "user_1", isAdmin: true },
    } as never);

    const admin = await requireAdmin(requestWithSession("token"));

    expect(admin).toBeNull();
  });

  it("returns null when the user is not an admin", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user_1", isAdmin: false },
    } as never);

    const admin = await requireAdmin(requestWithSession("token"));

    expect(admin).toBeNull();
  });

  it("returns the admin id for a valid admin session", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user_1", isAdmin: true },
    } as never);

    const admin = await requireAdmin(requestWithSession("token"));

    expect(admin).toEqual({ id: "user_1" });
  });
});

describe("getCurrentUser", () => {
  it("applies a COMP override to the returned subscription", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "user_1",
        email: "runner@example.com",
        emailVerifiedAt: null,
        name: null,
        subscription: "FREE",
        subscriptionOverride: "COMP",
        defaultLevel: "COMPETITIVE",
        defaultTargetTime: "1:25:00",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    } as never);

    const user = await getCurrentUser(requestWithSession("token"));

    expect(user?.subscription).toBe("ACTIVE");
  });

  it("passes through the Stripe status when there is no override", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "user_1",
        email: "runner@example.com",
        emailVerifiedAt: null,
        name: null,
        subscription: "PAST_DUE",
        subscriptionOverride: null,
        defaultLevel: "COMPETITIVE",
        defaultTargetTime: "1:25:00",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    } as never);

    const user = await getCurrentUser(requestWithSession("token"));

    expect(user?.subscription).toBe("PAST_DUE");
  });
});
