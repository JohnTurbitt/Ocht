import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

vi.mock("@/lib/apiAuth", () => ({
  getCurrentUser: vi.fn(),
  requireCurrentUser: vi.fn(),
}));

vi.mock("@/lib/logging", () => ({
  logServerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    raceReport: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/profile", () => ({
  toPublicUser: vi.fn((user) => ({
    id: user.id,
    email: user.email,
    subscription: user.subscription,
  })),
}));

vi.mock("@/lib/reportPersistence", () => ({
  toSavedReport: vi.fn((report) => ({
    id: report.id,
    goal: report.goal,
    level: "competitive",
  })),
}));

function exportRequest() {
  return new NextRequest("http://localhost/api/auth/me/export");
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

const databaseUser = {
  id: "user_1",
  email: "runner@example.com",
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  name: "Test Runner",
  subscription: "ACTIVE" as const,
  defaultLevel: "COMPETITIVE" as const,
  defaultTargetTime: "1:25:00",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const databaseReport = {
  id: "report_1",
  goal: "Sub 1:25",
  targetTime: "1:25:00",
  athleteLevel: "COMPETITIVE" as const,
  runSplits: ["8:00", "8:10"],
  stationSplits: { ski: "4:00" },
  trainingContext: null,
  finishSeconds: 5100,
  predictedTargetSeconds: 5000,
  topLeakLabel: "ski",
  analysisSnapshot: { raceFormat: "hyrox" },
  createdAt: new Date("2026-02-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.mocked(requireCurrentUser).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.raceReport.findMany).mockReset();
  vi.mocked(logServerError).mockClear();
});

describe("GET /api/auth/me/export", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(null);

    const response = await GET(exportRequest());

    expect(response.status).toBe(401);
  });

  it("returns the account and reports as a downloadable JSON payload", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(databaseUser as never);
    vi.mocked(prisma.raceReport.findMany).mockResolvedValue([databaseReport] as never);

    const response = await GET(exportRequest());
    const body = await response.json();

    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="ocht-data-export.json"',
    );
    expect(body.account).toMatchObject({
      id: "user_1",
      email: "runner@example.com",
      subscription: "ACTIVE",
    });
    expect(body.account.passwordHash).toBeUndefined();
    expect(body.account.stripeCustomerId).toBeUndefined();
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toMatchObject({
      id: "report_1",
      goal: "Sub 1:25",
      level: "competitive",
    });
    expect(typeof body.exportedAt).toBe("string");
  });

  it("returns 404 when the account no longer exists", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.raceReport.findMany).mockResolvedValue([] as never);

    const response = await GET(exportRequest());

    expect(response.status).toBe(404);
  });

  it("returns 500 when the export cannot be generated", async () => {
    vi.mocked(requireCurrentUser).mockResolvedValue(testUser);
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("DB is down"));
    vi.mocked(prisma.raceReport.findMany).mockResolvedValue([] as never);

    const response = await GET(exportRequest());

    expect(response.status).toBe(500);
    expect(logServerError).toHaveBeenCalledWith(
      "Account data export failed",
      expect.any(Error),
    );
  });
});
