import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import * as apiAuth from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import * as syncService from "@/lib/stravaSyncService";

vi.mock("@/lib/apiAuth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/stravaSyncService", () => ({ syncStravaProfile: vi.fn() }));
vi.mock("@/lib/stravaTokens", () => ({ encryptToken: (t: string) => `enc:${t}` }));
vi.mock("@/lib/logging", () => ({ logServerError: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { stravaConnection: { upsert: vi.fn() } },
}));

vi.stubEnv("STRAVA_CLIENT_ID", "cid");
vi.stubEnv("STRAVA_CLIENT_SECRET", "csec");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

function callbackReq(params: Record<string, string>, stateCookie = "state_abc") {
  const url = new URL("http://localhost/api/strava/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString(), {
    headers: { cookie: `strava_oauth_state=${stateCookie}` },
  });
}

beforeEach(() => {
  vi.mocked(apiAuth.getCurrentUser).mockReset();
  vi.mocked(prisma.stravaConnection.upsert).mockReset();
  vi.mocked(syncService.syncStravaProfile).mockReset();
});

describe("GET /api/strava/callback", () => {
  it("returns 400 when state cookie does not match query param", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    const res = await GET(callbackReq({ code: "abc", state: "different", scope: "activity:read_all" }, "state_abc"));
    expect(res.status).toBe(400);
  });

  it("redirects to /?strava=insufficient_scope when scope missing activity:read_all", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    const res = await GET(callbackReq({ code: "abc", state: "state_abc", scope: "profile:read_all" }));
    expect(res.headers.get("location")).toContain("strava=insufficient_scope");
  });

  it("upserts connection, triggers sync, and redirects on success", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    vi.mocked(prisma.stravaConnection.upsert).mockResolvedValue({} as never);
    vi.mocked(syncService.syncStravaProfile).mockResolvedValue();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "acc",
        refresh_token: "ref",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        athlete: { id: 99 },
      }),
    }) as never;

    const res = await GET(
      callbackReq({ code: "code", state: "state_abc", scope: "activity:read_all,profile:read_all" }),
    );

    expect(prisma.stravaConnection.upsert).toHaveBeenCalledOnce();
    expect(syncService.syncStravaProfile).toHaveBeenCalledWith("user_1");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("strava=connected");
  });
});
