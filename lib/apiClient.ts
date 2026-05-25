import { Level, Station, StationKey } from "./analysis";
import { RaceFormat } from "./raceFormats";
import { SavedReport } from "./reportStorage";

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  subscription: "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED";
  defaultLevel: Level;
  defaultTargetTime: string;
  createdAt: string;
};

export type AuthFormInput = {
  email: string;
  password: string;
  name?: string;
  signupCode?: string;
};

export type ProfileFormInput = {
  name?: string;
  defaultLevel: Level;
  defaultTargetTime: string;
};

export type ReportRequestInput = {
  goal: string;
  targetTime: string;
  level: Level;
  raceFormat: RaceFormat;
  runs: string[];
  stationDefinitions?: Station[];
  stationSplits: Record<StationKey, string>;
};

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errors = Array.isArray(body.errors)
      ? body.errors
      : [fallbackErrorForStatus(response.status)];

    throw new Error(errors.join(" "));
  }

  return body as T;
}

function fallbackErrorForStatus(status: number) {
  if (status === 401) {
    return "Sign in required.";
  }

  if (status === 403) {
    return "You do not have access to that action.";
  }

  if (status === 404) {
    return "That resource could not be found.";
  }

  if (status === 409) {
    return "That request conflicts with an existing record.";
  }

  if (status >= 500) {
    return "The server is having trouble. Try again in a moment.";
  }

  return "The server could not complete that request.";
}

export async function getCurrentUser() {
  const response = await fetch("/api/auth/me");
  const body = await readApiResponse<{ user: AuthUser | null }>(response);

  return body.user;
}

export async function updateProfile(input: ProfileFormInput) {
  const response = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readApiResponse<{ user: AuthUser }>(response);

  return body.user;
}

export async function signUp(input: AuthFormInput) {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readApiResponse<{ user: AuthUser }>(response);

  return body.user;
}

export async function logIn(input: AuthFormInput) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readApiResponse<{ user: AuthUser }>(response);

  return body.user;
}

export async function requestPasswordReset(email: string) {
  const response = await fetch("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  await readApiResponse<{ ok: true }>(response);
}

export async function resetPassword(input: { token: string; password: string }) {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  await readApiResponse<{ ok: true }>(response);
}

export async function verifyEmail(token: string) {
  const response = await fetch("/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  await readApiResponse<{ ok: true }>(response);
}

export async function resendEmailVerification() {
  const response = await fetch("/api/auth/resend-verification", {
    method: "POST",
  });

  await readApiResponse<{ ok: true }>(response);
}

export async function logOut() {
  const response = await fetch("/api/auth/logout", { method: "POST" });

  await readApiResponse<{ ok: true }>(response);
}

export async function loadRemoteReports() {
  const response = await fetch("/api/reports");
  const body = await readApiResponse<{ reports: SavedReport[] }>(response);

  return body.reports;
}

export async function saveRemoteReport(input: ReportRequestInput) {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readApiResponse<{ report: SavedReport }>(response);

  return body.report;
}

export async function deleteRemoteReport(reportId: string) {
  const response = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });

  await readApiResponse<{ ok: true }>(response);
}

export async function startCheckout() {
  const response = await fetch("/api/billing/checkout", { method: "POST" });
  const body = await readApiResponse<{ url: string | null }>(response);

  if (!body.url) {
    throw new Error("Checkout did not return a payment link.");
  }

  return body.url;
}

export async function openBillingPortal() {
  const response = await fetch("/api/billing/portal", { method: "POST" });
  const body = await readApiResponse<{ url: string | null }>(response);

  if (!body.url) {
    throw new Error("Billing settings did not return a link.");
  }

  return body.url;
}

export async function syncBillingStatus() {
  const response = await fetch("/api/billing/sync", { method: "POST" });
  const body = await readApiResponse<{ user: AuthUser }>(response);

  return body.user;
}
