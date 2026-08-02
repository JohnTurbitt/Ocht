export type AdminSubscriptionStatus = "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED";
export type AdminSubscriptionOverride = "COMP" | "DISABLED";
export type AdminOverrideAction = "GRANT_COMP" | "DISABLE" | "CLEAR_OVERRIDE";

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  subscription: AdminSubscriptionStatus;
  stripeCustomerId: string | null;
};

export type AdminActionEntry = {
  id: string;
  action: AdminOverrideAction;
  reason: string;
  createdAt: string;
  adminEmail: string;
};

export type AdminUserDetail = AdminUserSummary & {
  createdAt: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  stripeSubscription: AdminSubscriptionStatus;
  subscriptionOverride: AdminSubscriptionOverride | null;
  strava: { connected: boolean; connectedAt: string | null; revoked: boolean } | null;
  reportCount: number;
  lastReportAt: string | null;
  actions: AdminActionEntry[];
};

async function readAdminResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errors = Array.isArray(body.errors)
      ? body.errors
      : ["The server could not complete that request."];

    throw new Error(errors.join(" "));
  }

  return body as T;
}

export async function searchAdminUsers(query: string) {
  const response = await fetch(`/api/admin/users?query=${encodeURIComponent(query)}`);
  const body = await readAdminResponse<{ users: AdminUserSummary[] }>(response);

  return body.users;
}

export async function getAdminUserDetail(userId: string) {
  const response = await fetch(`/api/admin/users/${userId}`);
  const body = await readAdminResponse<{ user: AdminUserDetail }>(response);

  return body.user;
}

export async function submitAdminOverride(
  userId: string,
  input: { action: AdminOverrideAction; reason: string },
) {
  const response = await fetch(`/api/admin/users/${userId}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readAdminResponse<{ user: AdminUserDetail }>(response);

  return body.user;
}
