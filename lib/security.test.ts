import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceSameOrigin } from "./security";

function requestWith(headers: Record<string, string>) {
  return new NextRequest("http://127.0.0.1:3002/api/example", { headers });
}

describe("enforceSameOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows a request whose Origin matches the incoming Host header", () => {
    const request = requestWith({
      origin: "http://ocht.app",
      host: "ocht.app",
    });

    expect(enforceSameOrigin(request)).toBeNull();
  });

  it("rejects a request whose Origin does not match the incoming Host header", () => {
    const request = requestWith({
      origin: "http://evil.example",
      host: "ocht.app",
    });

    expect(enforceSameOrigin(request)?.status).toBe(403);
  });

  it("allows a same-origin request even when the underlying URL's host differs from the incoming Host header", () => {
    // Regression test for a real bug: under `next start --hostname`,
    // request.nextUrl can resolve to a different loopback alias than the
    // Host header the browser actually sent, which incorrectly rejected
    // same-origin requests when the check compared against nextUrl instead
    // of Host.
    const request = new NextRequest("http://127.0.0.1:3002/api/example", {
      headers: { origin: "http://localhost:3002", host: "localhost:3002" },
    });

    expect(enforceSameOrigin(request)).toBeNull();
  });

  it("falls back to the Referer header when Origin is absent", () => {
    const request = requestWith({
      referer: "http://ocht.app/app",
      host: "ocht.app",
    });

    expect(enforceSameOrigin(request)).toBeNull();
  });

  it("rejects when neither Origin nor a matching Referer is present", () => {
    const request = requestWith({ host: "ocht.app" });

    expect(enforceSameOrigin(request)?.status).toBe(403);
  });

  it("in development, treats localhost and 127.0.0.1 as the same origin", () => {
    vi.stubEnv("NODE_ENV", "development");

    const request = requestWith({
      origin: "http://127.0.0.1:3002",
      host: "localhost:3002",
    });

    expect(enforceSameOrigin(request)).toBeNull();
  });

  it("in production, does not treat localhost and 127.0.0.1 as the same origin", () => {
    vi.stubEnv("NODE_ENV", "production");

    const request = requestWith({
      origin: "http://127.0.0.1:3002",
      host: "localhost:3002",
    });

    expect(enforceSameOrigin(request)?.status).toBe(403);
  });
});
