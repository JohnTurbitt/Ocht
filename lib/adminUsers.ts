import { effectiveSubscription, SubscriptionOverride, SubscriptionStatus } from "./billing";
import { prisma } from "./prisma";

export type AdminOverrideAction = "GRANT_COMP" | "DISABLE" | "CLEAR_OVERRIDE";

export type AdminActionEntry = {
  id: string;
  action: AdminOverrideAction;
  reason: string;
  createdAt: string;
  adminEmail: string;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  subscription: SubscriptionStatus;
  stripeCustomerId: string | null;
};

export type AdminUserDetail = AdminUserSummary & {
  createdAt: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  stripeSubscription: SubscriptionStatus;
  subscriptionOverride: SubscriptionOverride | null;
  strava: { connected: boolean; connectedAt: string | null; revoked: boolean } | null;
  reportCount: number;
  lastReportAt: string | null;
  actions: AdminActionEntry[];
};

const userSummarySelect = {
  id: true,
  email: true,
  name: true,
  subscription: true,
  subscriptionOverride: true,
  stripeCustomerId: true,
} as const;

export async function searchAdminUsers(query: string): Promise<AdminUserSummary[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const users = trimmed.startsWith("cus_")
    ? await prisma.user.findMany({
        where: { stripeCustomerId: trimmed },
        select: userSummarySelect,
        take: 20,
      })
    : await prisma.user.findMany({
        where: { email: { contains: trimmed, mode: "insensitive" } },
        select: userSummarySelect,
        take: 20,
        orderBy: { email: "asc" },
      });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    subscription: effectiveSubscription(user),
    stripeCustomerId: user.stripeCustomerId,
  }));
}

export async function loadAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      subscription: true,
      subscriptionOverride: true,
      stripeCustomerId: true,
      createdAt: true,
      emailVerifiedAt: true,
      onboardingCompletedAt: true,
      stravaConnection: {
        select: { connectedAt: true, revokedAt: true },
      },
      _count: { select: { reports: true } },
      reports: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      adminActionsReceived: {
        select: {
          id: true,
          action: true,
          reason: true,
          createdAt: true,
          admin: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    subscription: effectiveSubscription(user),
    stripeSubscription: user.subscription,
    subscriptionOverride: user.subscriptionOverride,
    stripeCustomerId: user.stripeCustomerId,
    createdAt: user.createdAt.toISOString(),
    emailVerified: Boolean(user.emailVerifiedAt),
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    strava: user.stravaConnection
      ? {
          connected: !user.stravaConnection.revokedAt,
          connectedAt: user.stravaConnection.connectedAt.toISOString(),
          revoked: Boolean(user.stravaConnection.revokedAt),
        }
      : null,
    reportCount: user._count.reports,
    lastReportAt: user.reports[0]?.createdAt.toISOString() ?? null,
    actions: user.adminActionsReceived.map((entry) => ({
      id: entry.id,
      action: entry.action as AdminOverrideAction,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
      adminEmail: entry.admin.email,
    })),
  };
}

export async function applyAdminOverride(input: {
  adminId: string;
  targetUserId: string;
  action: AdminOverrideAction;
  reason: string;
}): Promise<AdminUserDetail | null> {
  const overrideValue: SubscriptionOverride | null =
    input.action === "GRANT_COMP" ? "COMP" : input.action === "DISABLE" ? "DISABLED" : null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: input.targetUserId },
      data: { subscriptionOverride: overrideValue },
    }),
    prisma.adminAction.create({
      data: {
        adminId: input.adminId,
        targetUserId: input.targetUserId,
        action: input.action,
        reason: input.reason,
      },
    }),
  ]);

  return loadAdminUserDetail(input.targetUserId);
}
