import { afterEach, describe, expect, it, vi } from "vitest";
import { releaseWakeLock, requestWakeLock } from "./wakeLock";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestWakeLock", () => {
  it("returns null when navigator.wakeLock is unsupported, without throwing", async () => {
    vi.stubGlobal("navigator", {});
    const result = await requestWakeLock();
    expect(result).toBeNull();
  });

  it("requests and returns a wake lock sentinel when supported", async () => {
    const fakeSentinel = { release: vi.fn().mockResolvedValue(undefined) };
    const request = vi.fn().mockResolvedValue(fakeSentinel);
    vi.stubGlobal("navigator", { wakeLock: { request } });

    const result = await requestWakeLock();

    expect(request).toHaveBeenCalledWith("screen");
    expect(result).toBe(fakeSentinel);
  });

  it("returns null if the request itself throws (e.g. permission denied)", async () => {
    const request = vi.fn().mockRejectedValue(new Error("not allowed"));
    vi.stubGlobal("navigator", { wakeLock: { request } });

    const result = await requestWakeLock();
    expect(result).toBeNull();
  });
});

describe("releaseWakeLock", () => {
  it("releases a real sentinel", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    await releaseWakeLock({ release } as unknown as WakeLockSentinel);
    expect(release).toHaveBeenCalled();
  });

  it("is a safe no-op when given null", async () => {
    await expect(releaseWakeLock(null)).resolves.toBeUndefined();
  });
});
