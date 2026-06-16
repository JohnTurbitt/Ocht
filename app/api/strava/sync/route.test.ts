import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { NextRequest, NextResponse } from "next/server";
import * as apiAuth from "@/lib/apiAuth";
import * as syncService from "@/lib/stravaSyncService";
import { guardBrowserMutation } from "@/lib/security";

vi.mock("@/lib/apiAuth", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/lib/stravaSyncService", () => ({ syncStravaProfile: vi.fn() }));
vi.mock("@/lib/logging", () => ({ logServerError: vi.fn() }));
vi.mock("@/lib/security", () => ({ guardBrowserMutation: vi.fn(() => null) }));

function req() {
  return new NextRequest("http://localhost/api/strava/sync", { method: "POST" });
}

beforeEach(() => {
  vi.mocked(apiAuth.requireCurrentUser).mockReset();
  vi.mocked(syncService.syncStravaProfile).mockReset();
  vi.mocked(guardBrowserMutation).mockReturnValue(null);
});

describe("POST /api/strava/sync", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(apiAuth.requireCurrentUser).mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
  });

  it("returns ok:true after successful sync", async () => {
    vi.mocked(apiAuth.requireCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    vi.mocked(syncService.syncStravaProfile).mockResolvedValue();
    expect(await (await POST(req())).json()).toEqual({ ok: true });
  });

  it("returns guard response when rate limited", async () => {
    vi.mocked(guardBrowserMutation).mockReturnValue(
      NextResponse.json({ errors: ["Too many requests."] }, { status: 429 }),
    );
    expect((await POST(req())).status).toBe(429);
  });
});
