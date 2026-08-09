import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import * as apiAuth from "@/lib/apiAuth";

vi.mock("@/lib/apiAuth", () => ({ getCurrentUser: vi.fn() }));
vi.stubEnv("STRAVA_CLIENT_ID", "test_client_id");
vi.stubEnv("STRAVA_CLIENT_SECRET", "test_secret");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

function req() {
  return new NextRequest("http://localhost/api/strava/connect");
}

describe("GET /api/strava/connect", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("redirects to Strava OAuth URL with correct params", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    const res = await GET(req());
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("https://www.strava.com/oauth/authorize");
    expect(location).toContain("client_id=test_client_id");
    expect(location).toContain("activity%3Aread_all");
    expect(location).toContain("state=");
  });
});
