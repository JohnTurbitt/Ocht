import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logServerError } from "@/lib/logging";
import { POST } from "./route";

vi.mock("@/lib/logging", () => ({
  logServerError: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  guardBrowserMutation: vi.fn(() => null),
}));

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/errors", () => {
  beforeEach(() => {
    vi.mocked(logServerError).mockClear();
  });

  it("logs a well-formed payload and returns ok", async () => {
    const response = await POST(
      postRequest({
        message: "Boom",
        digest: "abc123",
        stack: "Error: Boom\n at foo",
        pathname: "/report",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(logServerError).toHaveBeenCalledWith("Client error reported", {
      message: "Boom",
      digest: "abc123",
      stack: "Error: Boom\n at foo",
      pathname: "/report",
    });
  });

  it("truncates oversized fields before logging", async () => {
    const longMessage = "x".repeat(600);
    const longStack = "y".repeat(5000);

    await POST(
      postRequest({
        message: longMessage,
        stack: longStack,
        pathname: "/report",
      }),
    );

    const [, payload] = vi.mocked(logServerError).mock.calls[0];
    expect((payload as Record<string, string>).message).toHaveLength(500);
    expect((payload as Record<string, string>).stack).toHaveLength(4000);
  });

  it("returns ok and logs even with a malformed body", async () => {
    const response = await POST(postRequest("not json"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(logServerError).toHaveBeenCalledWith(
      "Failed to process client error report",
      expect.anything(),
    );
  });
});
