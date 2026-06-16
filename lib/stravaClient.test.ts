import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActivities, getAthlete } from "./stravaClient";
import * as tokens from "./stravaTokens"; // This will be mocked below

vi.mock("./stravaTokens", () => ({
  getValidAccessToken: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(tokens.getValidAccessToken).mockReset();
});

describe("getAthlete", () => {
  it("calls /athlete with Authorization header and returns JSON", async () => {
    vi.mocked(tokens.getValidAccessToken).mockResolvedValue("tok_abc");
    const athlete = { id: 1, firstname: "John", lastname: "Doe", profile: "" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => athlete,
    }) as never;

    const result = await getAthlete("user_1");

    expect(fetch).toHaveBeenCalledWith(
      "https://www.strava.com/api/v3/athlete",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok_abc" }),
      }),
    );
    expect(result).toEqual(athlete);
  });

  it("throws when Strava returns non-ok status", async () => {
    vi.mocked(tokens.getValidAccessToken).mockResolvedValue("tok_abc");
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as never;
    await expect(getAthlete("user_1")).rejects.toThrow("401");
  });
});

describe("getActivities", () => {
  it("passes perPage and after as query params", async () => {
    vi.mocked(tokens.getValidAccessToken).mockResolvedValue("tok_abc");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as never;

    await getActivities("user_1", { perPage: 200, after: 1700000000 });

    const calledUrl = (vi.mocked(fetch).mock.calls[0][0] as string);
    expect(calledUrl).toContain("per_page=200");
    expect(calledUrl).toContain("after=1700000000");
  });
});
