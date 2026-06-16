import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import * as apiAuth from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/apiAuth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { stravaConnection: { findUnique: vi.fn() } },
}));

function req() {
  return new NextRequest("http://localhost/api/strava/status");
}

beforeEach(() => {
  vi.mocked(apiAuth.getCurrentUser).mockReset();
  vi.mocked(prisma.stravaConnection.findUnique).mockReset();
});

describe("GET /api/strava/status", () => {
  it("returns connected:false when not authenticated", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue(null);
    expect((await (await GET(req())).json()).connected).toBe(false);
  });

  it("returns connected:true with syncedAt when connected and profile exists", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    const syncedAt = new Date("2026-06-16T10:00:00Z");
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue({
      revokedAt: null,
      profile: { lastSyncedAt: syncedAt },
    } as never);

    const body = await (await GET(req())).json();
    expect(body.connected).toBe(true);
    expect(body.syncedAt).toBe(syncedAt.toISOString());
    expect(body.hasProfile).toBe(true);
  });
});
