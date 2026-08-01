import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

function requestTo(url: string, cookie?: string) {
  return new NextRequest(url, cookie ? { headers: { cookie } } : undefined);
}

describe("middleware", () => {
  it("lets logged-out visitors through to the landing page", () => {
    const response = middleware(requestTo("http://localhost/"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a logged-in visitor from / to /app", () => {
    const response = middleware(
      requestTo("http://localhost/", "ocht_session=abc123"),
    );

    expect(response.headers.get("location")).toBe("http://localhost/app");
  });

  it("preserves the query string when redirecting", () => {
    const response = middleware(
      requestTo(
        "http://localhost/?checkout=success&return_to=%2Fapp",
        "ocht_session=abc123",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost/app?checkout=success&return_to=%2Fapp",
    );
  });
});
