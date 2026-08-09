import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import { applyAdminOverride, loadAdminUserDetail, searchAdminUsers } from "./adminUsers";

vi.mock("./prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminAction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(prisma.user.findMany).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.update).mockReset();
  vi.mocked(prisma.adminAction.create).mockReset();
  vi.mocked(prisma.$transaction).mockReset();
});

describe("searchAdminUsers", () => {
  it("returns nothing for a blank query without hitting the database", async () => {
    const results = await searchAdminUsers("   ");

    expect(results).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("matches by exact stripeCustomerId when the query looks like one", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user_1",
        email: "jane@example.com",
        name: "Jane Doe",
        subscription: "ACTIVE",
        subscriptionOverride: null,
        stripeCustomerId: "cus_123",
      },
    ] as never);

    const results = await searchAdminUsers("cus_123");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeCustomerId: "cus_123" } }),
    );
    expect(results).toEqual([
      {
        id: "user_1",
        email: "jane@example.com",
        name: "Jane Doe",
        subscription: "ACTIVE",
        stripeCustomerId: "cus_123",
      },
    ]);
  });

  it("matches by partial email otherwise, and applies the override to the summary", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user_1",
        email: "jane@example.com",
        name: "Jane Doe",
        subscription: "FREE",
        subscriptionOverride: "COMP",
        stripeCustomerId: null,
      },
    ] as never);

    const results = await searchAdminUsers("jane");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { contains: "jane", mode: "insensitive" } },
      }),
    );
    expect(results[0].subscription).toBe("ACTIVE");
  });
});

describe("loadAdminUserDetail", () => {
  it("returns null when the user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const detail = await loadAdminUserDetail("missing_user");

    expect(detail).toBeNull();
  });

  it("maps a found user into the detail shape, applying the override", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "jane@example.com",
      name: "Jane Doe",
      subscription: "ACTIVE",
      subscriptionOverride: "DISABLED",
      stripeCustomerId: "cus_123",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      emailVerifiedAt: new Date("2026-06-02T00:00:00.000Z"),
      onboardingCompletedAt: null,
      stravaConnection: {
        connectedAt: new Date("2026-06-03T00:00:00.000Z"),
        revokedAt: null,
      },
      _count: { reports: 3 },
      reports: [{ createdAt: new Date("2026-07-01T00:00:00.000Z") }],
      adminActionsReceived: [
        {
          id: "action_1",
          action: "DISABLE",
          reason: "investigating a chargeback",
          createdAt: new Date("2026-07-02T00:00:00.000Z"),
          admin: { email: "you@example.com" },
        },
      ],
    } as never);

    const detail = await loadAdminUserDetail("user_1");

    expect(detail).toEqual({
      id: "user_1",
      email: "jane@example.com",
      name: "Jane Doe",
      subscription: "FREE",
      stripeSubscription: "ACTIVE",
      subscriptionOverride: "DISABLED",
      stripeCustomerId: "cus_123",
      createdAt: "2026-06-01T00:00:00.000Z",
      emailVerified: true,
      onboardingCompleted: false,
      strava: {
        connected: true,
        connectedAt: "2026-06-03T00:00:00.000Z",
        revoked: false,
      },
      reportCount: 3,
      lastReportAt: "2026-07-01T00:00:00.000Z",
      actions: [
        {
          id: "action_1",
          action: "DISABLE",
          reason: "investigating a chargeback",
          createdAt: "2026-07-02T00:00:00.000Z",
          adminEmail: "you@example.com",
        },
      ],
    });
  });
});

describe("applyAdminOverride", () => {
  it("writes the COMP override and an audit row, then returns refreshed detail", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "jane@example.com",
      name: null,
      subscription: "FREE",
      subscriptionOverride: "COMP",
      stripeCustomerId: null,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      emailVerifiedAt: null,
      onboardingCompletedAt: null,
      stravaConnection: null,
      _count: { reports: 0 },
      reports: [],
      adminActionsReceived: [],
    } as never);

    const detail = await applyAdminOverride({
      adminId: "admin_1",
      targetUserId: "user_1",
      action: "GRANT_COMP",
      reason: "beta tester",
    });

    expect(prisma.$transaction).toHaveBeenCalledWith([
      prisma.user.update({
        where: { id: "user_1" },
        data: { subscriptionOverride: "COMP" },
      }),
      prisma.adminAction.create({
        data: {
          adminId: "admin_1",
          targetUserId: "user_1",
          action: "GRANT_COMP",
          reason: "beta tester",
        },
      }),
    ]);
    expect(detail?.subscriptionOverride).toBe("COMP");
  });

  it("clears the override by writing null", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "jane@example.com",
      name: null,
      subscription: "ACTIVE",
      subscriptionOverride: null,
      stripeCustomerId: null,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      emailVerifiedAt: null,
      onboardingCompletedAt: null,
      stravaConnection: null,
      _count: { reports: 0 },
      reports: [],
      adminActionsReceived: [],
    } as never);

    await applyAdminOverride({
      adminId: "admin_1",
      targetUserId: "user_1",
      action: "CLEAR_OVERRIDE",
      reason: "resolved",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { subscriptionOverride: null },
    });
  });
});
