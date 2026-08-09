import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncStravaProfile } from "./stravaSyncService";
import * as client from "./stravaClient";
import * as prismaModule from "./prisma";

vi.mock("./stravaClient", () => ({
  getActivities: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: {
    stravaProfile: { upsert: vi.fn() },
    stravaConnection: { findUnique: vi.fn() },
  },
}));

beforeEach(() => {
  vi.mocked(client.getActivities).mockReset();
  vi.mocked(prismaModule.prisma.stravaProfile.upsert).mockReset();
  vi.mocked(prismaModule.prisma.stravaConnection.findUnique).mockReset();
});

describe("syncStravaProfile", () => {
  it("fetches activities and upserts the profile", async () => {
    vi.mocked(prismaModule.prisma.stravaConnection.findUnique).mockResolvedValue({ id: "conn_1" } as never);
    vi.mocked(client.getActivities).mockResolvedValue([]);
    vi.mocked(prismaModule.prisma.stravaProfile.upsert).mockResolvedValue({} as never);

    await syncStravaProfile("user_1");

    expect(client.getActivities).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ perPage: 200 }),
    );
    expect(prismaModule.prisma.stravaProfile.upsert).toHaveBeenCalledOnce();
  });

  it("throws when no connection exists for the user", async () => {
    vi.mocked(prismaModule.prisma.stravaConnection.findUnique).mockResolvedValue(null);
    await expect(syncStravaProfile("user_1")).rejects.toThrow("No Strava connection");
  });
});
