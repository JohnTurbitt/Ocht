import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken, getValidAccessToken, StravaTokenError } from "./stravaTokens";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stravaConnection: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.stubEnv("STRAVA_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32).toString("base64"));
vi.stubEnv("STRAVA_CLIENT_ID", "test_client_id");
vi.stubEnv("STRAVA_CLIENT_SECRET", "test_client_secret");

beforeEach(() => {
  vi.mocked(prisma.stravaConnection.findUnique).mockReset();
  vi.mocked(prisma.stravaConnection.update).mockReset();
});

describe("encryptToken / decryptToken", () => {
  it("roundtrips a token string", () => {
    const plaintext = "my_secret_access_token_abc123";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const a = encryptToken("same_token");
    const b = encryptToken("same_token");
    expect(a).not.toBe(b);
  });
});

describe("getValidAccessToken", () => {
  it("throws StravaTokenError when no connection exists", async () => {
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue(null);
    await expect(getValidAccessToken("user_1")).rejects.toThrow(StravaTokenError);
  });

  it("returns decrypted access token when not expired", async () => {
    const token = "valid_access_token";
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue({
      accessToken: encryptToken(token),
      refreshToken: encryptToken("refresh"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } as never);

    const result = await getValidAccessToken("user_1");
    expect(result).toBe(token);
    expect(prisma.stravaConnection.update).not.toHaveBeenCalled();
  });

  it("refreshes and stores new tokens when expired", async () => {
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue({
      accessToken: encryptToken("old_access"),
      refreshToken: encryptToken("old_refresh"),
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    vi.mocked(prisma.stravaConnection.update).mockResolvedValue({} as never);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new_access_token",
        refresh_token: "new_refresh_token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    }) as never;

    const result = await getValidAccessToken("user_1");
    expect(result).toBe("new_access_token");
    expect(prisma.stravaConnection.update).toHaveBeenCalledOnce();
  });

  it("throws StravaTokenError when refresh request fails", async () => {
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue({
      accessToken: encryptToken("access"),
      refreshToken: encryptToken("refresh"),
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as never;

    await expect(getValidAccessToken("user_1")).rejects.toThrow(StravaTokenError);
  });
});
