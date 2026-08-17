export type PacingCtaContent = {
  heading: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
};

export function getPacingCtaContent(signedIn: boolean | null): PacingCtaContent {
  if (signedIn) {
    return {
      heading: "Now go run it.",
      body: "Log your real splits after training or racing and Ocht will show you exactly where this plan held up — and where it didn't.",
      buttonLabel: "Log my splits",
      buttonHref: "/app",
    };
  }

  return {
    heading: "Now go run it.",
    body: "Sign up free to save this plan and compare it against your real splits once you've raced or trained against it.",
    buttonLabel: "Sign up free",
    buttonHref: "/app?auth=signup",
  };
}
