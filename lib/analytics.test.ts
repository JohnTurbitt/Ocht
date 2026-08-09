import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { trackMock, hasAnalyticsConsentMock } = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";

  return {
    trackMock: vi.fn(),
    hasAnalyticsConsentMock: vi.fn(),
  };
});

vi.mock("@vercel/analytics", () => ({
  track: trackMock,
}));

vi.mock("./cookieConsent", () => ({
  hasAnalyticsConsent: hasAnalyticsConsentMock,
}));

import { trackEvent } from "./analytics";

beforeEach(() => {
  trackMock.mockClear();
  hasAnalyticsConsentMock.mockReset();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
});

describe("trackEvent", () => {
  it("does not call track when analytics consent has not been granted", () => {
    hasAnalyticsConsentMock.mockReturnValue(false);

    trackEvent("report_generated");

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("calls track when enabled and consent has been granted", () => {
    hasAnalyticsConsentMock.mockReturnValue(true);

    trackEvent("report_generated", { source: "test" });

    expect(trackMock).toHaveBeenCalledWith("report_generated", { source: "test" });
  });
});
