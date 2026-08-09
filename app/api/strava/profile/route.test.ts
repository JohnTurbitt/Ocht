import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import * as apiAuth from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/apiAuth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { stravaProfile: { findUnique: vi.fn() } },
}));

function req() {
  return new NextRequest("http://localhost/api/strava/profile");
}

beforeEach(() => {
  vi.mocked(apiAuth.getCurrentUser).mockReset();
  vi.mocked(prisma.stravaProfile.findUnique).mockReset();
});

describe("GET /api/strava/profile", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns profile:null when no Strava profile exists", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    vi.mocked(prisma.stravaProfile.findUnique).mockResolvedValue(null);
    const body = await (await GET(req())).json();
    expect(body.profile).toBeNull();
  });

  it("returns full profile when Strava profile exists", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    const lastSyncedAt = new Date("2026-06-16T10:00:00Z");
    const mockProfile = {
      runsPerWeek: 3.5,
      weeklyDistanceKm: 28.4,
      longestRunKm: 12.1,
      hardRunsPerWeek: 0.8,
      restDaysPerWeek: 2.0,
      lthrBpm: 163,
      cardiacDecouplingPct: 4.2,
      ctlScore: 42.1,
      atlScore: 38.5,
      paceZonesJson: { z1: { minPaceSec: 420, maxPaceSec: 9999 }, z2: { minPaceSec: 360, maxPaceSec: 419 }, z3: { minPaceSec: 315, maxPaceSec: 359 }, z4: { minPaceSec: 300, maxPaceSec: 314 }, z5: { minPaceSec: 0, maxPaceSec: 299 } },
      bestEffort5kSeconds: 1470,
      bestEffort10kSeconds: 3080,
      lastSyncedAt,
    };
    vi.mocked(prisma.stravaProfile.findUnique).mockResolvedValue(mockProfile as never);

    const body = await (await GET(req())).json();
    expect(body.profile.lthrBpm).toBe(163);
    expect(body.profile.runsPerWeek).toBe(3.5);
    expect(body.profile.bestEffort5kSeconds).toBe(1470);
    expect(body.profile.cardiacDecouplingPct).toBe(4.2);
    expect(body.profile.paceZonesJson).toBeDefined();
  });

  it("queries by the authenticated user id", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_abc" } as never);
    vi.mocked(prisma.stravaProfile.findUnique).mockResolvedValue(null);
    await GET(req());
    expect(prisma.stravaProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user_abc" } }),
    );
  });
});
