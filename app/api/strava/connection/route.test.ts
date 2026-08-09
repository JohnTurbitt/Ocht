import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";
import { NextRequest } from "next/server";
import * as apiAuth from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import * as tokens from "@/lib/stravaTokens";

vi.mock("@/lib/apiAuth", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/lib/logging", () => ({ logServerError: vi.fn() }));
vi.mock("@/lib/security", () => ({ guardBrowserMutation: vi.fn(() => null) }));
vi.mock("@/lib/stravaTokens", () => ({ getValidAccessToken: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    stravaProfile: { deleteMany: vi.fn() },
    stravaConnection: { deleteMany: vi.fn() },
  },
}));

function req() {
  return new NextRequest("http://localhost/api/strava/connection", { method: "DELETE" });
}

beforeEach(() => {
  vi.mocked(apiAuth.requireCurrentUser).mockReset();
  vi.mocked(prisma.stravaProfile.deleteMany).mockReset();
  vi.mocked(prisma.stravaConnection.deleteMany).mockReset();
  vi.mocked(tokens.getValidAccessToken).mockReset();
});

describe("DELETE /api/strava/connection", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(apiAuth.requireCurrentUser).mockResolvedValue(null);
    expect((await DELETE(req())).status).toBe(401);
  });

  it("deletes profile and connection records and returns ok:true", async () => {
    vi.mocked(apiAuth.requireCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    vi.mocked(tokens.getValidAccessToken).mockResolvedValue("tok");
    vi.mocked(prisma.stravaProfile.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.stravaConnection.deleteMany).mockResolvedValue({ count: 1 } as never);
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as never;

    const res = await DELETE(req());
    expect(prisma.stravaProfile.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(prisma.stravaConnection.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(await res.json()).toEqual({ ok: true });
  });
});
