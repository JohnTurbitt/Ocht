import { describe, expect, it } from "vitest";
import { getPacingCtaContent } from "./pacingCta";

describe("getPacingCtaContent", () => {
  it("prompts sign-up when signed out", () => {
    const content = getPacingCtaContent(false);
    expect(content.buttonLabel).toBe("Sign up free");
    expect(content.buttonHref).toBe("/app?auth=signup");
    expect(content.body).toContain("Sign up free");
  });

  it("prompts logging splits when signed in", () => {
    const content = getPacingCtaContent(true);
    expect(content.buttonLabel).toBe("Log my splits");
    expect(content.buttonHref).toBe("/app");
    expect(content.body).not.toContain("Sign up");
  });

  it("treats unknown (null) auth state the same as signed out", () => {
    const content = getPacingCtaContent(null);
    expect(content.buttonLabel).toBe("Sign up free");
    expect(content.buttonHref).toBe("/app?auth=signup");
  });
});
