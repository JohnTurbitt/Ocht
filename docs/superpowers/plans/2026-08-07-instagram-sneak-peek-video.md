# Instagram Sneak-Peek Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `video/out/ocht-sneak-peek-vertical.mp4` (1080x1920) and
`video/out/ocht-sneak-peek-square.mp4` (1080x1080), two ~30s "sneak peek"
videos of Ocht for social, built from fresh screenshots of the current
(redesigned) app, bookended by the already-approved shield reveal.

**Architecture:** Extract the shield/ring SVG markup and dark palette out of
`InstagramReveal.tsx` into a shared `brandMark.tsx` so it isn't duplicated a
third time. Capture 8 fresh screenshots from the live dev server across
three short browser sessions (signed-out, a fresh throwaway signup, and the
existing premium seed account). Build one aspect-ratio-agnostic
`SneakPeekVideo.tsx` (full-bleed screenshot + Ken Burns + bold kinetic
caption per beat, hard cuts, shield bookends) driven by a single shared
`sneakPeekBeats.ts` data file, and register it as two Remotion
`Composition`s (1080x1920 and 1080x1080) in `Root.tsx` — same component,
different dimensions, so the two formats can never drift apart on content.

**Tech Stack:** Remotion 4 (existing `video/` project — `remotion`,
`@remotion/cli`, `@remotion/google-fonts`), React 19, TypeScript. Screenshot
capture via browser automation against the existing Next.js dev server
(`npm run dev`, port 3002, from the repo root, not `video/`).

---

## Reference: brand constants (already live in `InstagramReveal.tsx`, being extracted)

```ts
PAPER     = "#08100d"
LIME      = "#c8ff2e"
BADGE_INK = "#0b120f"
MUTED     = "#adbaaa"
RING_LINE = "rgba(200, 255, 46, 0.4)"
```

## Reference: beat sequence (30fps, 900 frames total = 30s)

| # | id | frames | screenshot | caption |
|---|---|---|---|---|
| intro | — | 0–60 | — | — |
| 1 | `hero` | 60–150 | `screenshots/sneak-peek/01-hero.png` | "Know exactly where you lose time" |
| 2 | `strava-connect` | 150–240 | `screenshots/sneak-peek/02-strava-connect.png` | "Connect Strava" |
| 3 | `format-picker` | 240–330 | `screenshots/sneak-peek/03-format-picker.png` | "Hyrox. Tryka. Or build your own." |
| 4 | `split-form` | 330–420 | `screenshots/sneak-peek/04-split-form.png` | "Log your splits" |
| 5 | `results-archetype` | 420–540 | `screenshots/sneak-peek/05-results-archetype.png` | "Meet your archetype" |
| 6 | `blueprint-leaks` | 540–660 | `screenshots/sneak-peek/06-blueprint-leaks.png` | "Find your leaks" |
| 7 | `training-simulator` | 660–750 | `screenshots/sneak-peek/07-training-simulator.png` | "Your 4-week focus" |
| 8 | `premium-unlock` | 750–840 | `screenshots/sneak-peek/08-premium-unlock.png` | "Unlock the full report" |
| outro | — | 840–900 | — | "ocht.app" |

---

### Task 1: Extract `brandMark.tsx` and refactor `InstagramReveal.tsx` to use it

**Files:**
- Create: `video/src/brandMark.tsx`
- Modify: `video/src/InstagramReveal.tsx`

- [ ] **Step 1: Create `video/src/brandMark.tsx`**

```tsx
export const PAPER = "#08100d";
export const LIME = "#c8ff2e";
export const BADGE_INK = "#0b120f";
export const MUTED = "#adbaaa";
export const RING_LINE = "rgba(200, 255, 46, 0.4)";
export const RING_DOT_OPACITY = 0.7;

export const RING_POINTS: Array<[number, number]> = [
  [55, 5],
  [90, 18],
  [105, 55],
  [90, 92],
  [55, 105],
  [20, 92],
  [5, 55],
  [20, 18],
];

type ShieldMarkProps = {
  size: number;
  displayFontFamily: string;
  opacity?: number;
  scale?: number;
};

export function ShieldMark({
  size,
  displayFontFamily,
  opacity = 1,
  scale = 1,
}: ShieldMarkProps) {
  return (
    <svg
      width={size}
      height={Math.round((size * 78) / 64)}
      viewBox="0 0 64 78"
      fill="none"
      style={{
        opacity,
        transform: `scale(${scale})`,
        filter: `drop-shadow(0 6px 22px ${LIME}59)`,
      }}
    >
      <path
        d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
        fill={LIME}
      />
      <text
        x="32"
        y="56"
        textAnchor="middle"
        fontFamily={displayFontFamily}
        fontWeight={900}
        fontSize={46}
        fill={BADGE_INK}
      >
        8
      </text>
    </svg>
  );
}

type RingMarkProps = {
  size: number;
  opacity?: number;
  rotationDeg?: number;
};

export function RingMark({ size, opacity = 1, rotationDeg = 0 }: RingMarkProps) {
  return (
    <svg
      viewBox="0 0 110 110"
      fill="none"
      style={{
        position: "absolute",
        inset: 0,
        width: size,
        height: size,
        opacity,
        transform: `rotate(${rotationDeg}deg)`,
      }}
    >
      <polygon
        points={RING_POINTS.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke={RING_LINE}
        strokeWidth={1.5}
      />
      <g>
        {RING_POINTS.map(([cx, cy]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={3}
            fill={LIME}
            opacity={RING_DOT_OPACITY}
          />
        ))}
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: Replace `video/src/InstagramReveal.tsx` with the refactored version**

```tsx
import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/DMMono";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LIME, MUTED, PAPER, RingMark, ShieldMark } from "./brandMark";

const display = loadDisplayFont("normal", { weights: ["900"] });
const mono = loadMonoFont("normal", { weights: ["400"] });

const RING_SIZE = 460;
const SHIELD_SIZE = 150;

// Angle stays at 0 until ACCEL_START_FRAME, then grows as angle = K * t^2 —
// a true constant-acceleration ramp (not an eased/bezier approximation), so
// the ring visibly "picks up speed like a car" rather than snapping into a spin.
const ACCEL_START_FRAME = 99;
const ACCEL_K = 0.05;

export function InstagramReveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shieldOpacity = interpolate(frame, [fps * 0.3, fps * 2.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shieldScale = interpolate(frame, [fps * 0.3, fps * 2.4], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowOpacity = interpolate(frame, [fps * 2.6, fps * 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ringOpacity = interpolate(frame, [fps * 3, fps * 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const accelT = Math.max(0, frame - ACCEL_START_FRAME);
  const ringRotation = ACCEL_K * accelT * accelT;

  const identityOpacity = interpolate(frame, [fps * 4.4, fps * 5.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const identityTranslateY = interpolate(frame, [fps * 4.4, fps * 5.8], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: PAPER,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${LIME}55 0%, ${LIME}00 70%)`,
          filter: "blur(50px)",
          opacity: glowOpacity,
        }}
      />

      <div
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: RING_SIZE,
          height: RING_SIZE,
        }}
      >
        <RingMark size={RING_SIZE} opacity={ringOpacity} rotationDeg={ringRotation} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <ShieldMark
            size={SHIELD_SIZE}
            displayFontFamily={display.fontFamily}
            opacity={shieldOpacity}
            scale={shieldScale}
          />
        </div>
      </div>

      <p
        style={{
          marginTop: 32,
          fontFamily: mono.fontFamily,
          fontWeight: 400,
          fontSize: 22,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: MUTED,
          opacity: identityOpacity,
          transform: `translateY(${identityTranslateY}px)`,
        }}
      >
        8 stations · 8 runs · 1 race
      </p>
    </AbsoluteFill>
  );
}

export const INSTAGRAM_REVEAL_DURATION_IN_FRAMES = 300;
export const INSTAGRAM_REVEAL_FPS = 30;
```

- [ ] **Step 3: Re-render the two regression stills and confirm no visual change**

From `video/`:

```bash
npx remotion still src/index.ts InstagramReveal out/regression-frame-20.png --frame=20
npx remotion still src/index.ts InstagramReveal out/regression-frame-150.png --frame=150
```

Read both PNGs. Expected: pixel-identical in composition to the
already-approved reveal video — frame 20 shows the dim shield fading in from
darkness, frame 150 shows the full bloom/ring/identity-text state. This is a
pure refactor: same constants, same markup, just relocated.

- [ ] **Step 4: Clean up regression stills and commit**

```bash
rm -f out/regression-frame-20.png out/regression-frame-150.png
git add video/src/brandMark.tsx video/src/InstagramReveal.tsx
git commit -m "Extract shared shield/ring brand mark from InstagramReveal"
```

---

### Task 2: Capture screenshot — signed-out hero

**Files:**
- Create: `video/public/screenshots/sneak-peek/01-hero.png`

- [ ] **Step 1: Start the dev server**

From the repo root (`C:\Users\johnt\Documents\Ocht`), run in the background:

```bash
npm run dev
```

Wait until it logs ready on `http://127.0.0.1:3002`.

- [ ] **Step 2: Open the app signed out, at a mobile viewport**

Using browser automation: open a new page, navigate to
`http://127.0.0.1:3002`, resize to **390x844**. Do not log in. Wait for the
launch splash animation to finish (~2s) so the hero (`components/Hero.tsx`)
is fully visible — heading, eyebrow, and the `hero__ring`/shield motif.

- [ ] **Step 3: Capture the hero**

Take a full-viewport screenshot and save it as
`video/public/screenshots/sneak-peek/01-hero.png`.

- [ ] **Step 4: Verify and commit**

```bash
ls video/public/screenshots/sneak-peek/
```

Expected: `01-hero.png` present, non-zero size.

```bash
git add video/public/screenshots/sneak-peek/01-hero.png
git commit -m "Capture signed-out hero screenshot for sneak-peek video"
```

---

### Task 3: Capture screenshots — fresh signup flow (Strava connect, format picker, split form, results/archetype, premium paywall)

**Files:**
- Create: `video/public/screenshots/sneak-peek/02-strava-connect.png`
- Create: `video/public/screenshots/sneak-peek/03-format-picker.png`
- Create: `video/public/screenshots/sneak-peek/04-split-form.png`
- Create: `video/public/screenshots/sneak-peek/05-results-archetype.png`
- Create: `video/public/screenshots/sneak-peek/08-premium-unlock.png`

A fresh signup starts with no `onboardingCompletedAt` (triggers
`OnboardingGate` → `OnboardingModal`) and no `ACTIVE` subscription (shows the
real "Unlock full report" paywall, unlike the seeded dev accounts which are
all pre-activated). This session covers 5 of the 8 screenshots because both
of those states only exist right after a brand-new signup.

Continues from Task 2 (dev server running, 390x844 viewport). Requires the
local `.env`'s `BETA_SIGNUP_CODE` value — check with:

```bash
grep BETA_SIGNUP_CODE .env
```

(Currently `ocht-beta-2026` — use whatever the file actually says.)

- [ ] **Step 1: Sign up a new throwaway account**

Reload `http://127.0.0.1:3002` signed out. Open the account menu in the
header (`AuthPanel`, top-right) and click **"Join Ocht"**. Fill the signup
form:
- Name: `Sneak Peek Demo`
- Beta code: the value from `.env`'s `BETA_SIGNUP_CODE`
- Email: `sneak.peek.demo@ocht.dev`
- Password: `OchtDemoPass123!`

Submit (**"Create account"**). Expected: a success toast ("Account
created...") and the `OnboardingModal` (`components/onboarding/GoalScreen.tsx`)
appears automatically.

- [ ] **Step 2: Advance onboarding to the Strava-connect screen**

On the `GoalScreen`, click **"I'm training for my first Hyrox"** (the
`training` goal — its description explicitly mentions Strava). This advances
`OnboardingModal` to `step === "strava"`, rendering
`components/onboarding/StravaConnectScreen.tsx` — title "Make your reports
personal", the "Connect with Strava" button, and the benefits list.

- [ ] **Step 3: Capture the Strava-connect screen**

Take a screenshot and save it as
`video/public/screenshots/sneak-peek/02-strava-connect.png`.

- [ ] **Step 4: Skip Strava and land in the app**

Click the skip button (**"Skip. Enter details manually"**) to dismiss
onboarding without a real OAuth round-trip.

- [ ] **Step 5: Capture the format picker**

On the "New report" tab, scroll to the race-format picker (`.format-picker`,
`aria-label="Race format"` in `components/SplitForm.tsx`) so all four cards
— **HYROX**, **TRYKA 800**, **TRYKA 500**, **Custom** (with its premium
badge) — are visible in one shot. Take a screenshot and save it as
`video/public/screenshots/sneak-peek/03-format-picker.png`.

- [ ] **Step 6: Capture the filled split form**

Click **"Load sample race"** (visible in the hero's empty-state card once
the workspace is empty) to populate sample run/station splits. Scroll so the
filled-in fields are visible. Take a screenshot and save it as
`video/public/screenshots/sneak-peek/04-split-form.png`.

- [ ] **Step 7: Generate the report and capture the archetype**

Submit the form (**"Generate race report"**). Once
`ReportGenerationOverlay` finishes and the report renders, scroll to
`#report-profile` (the `archetype-hero` block: `AthleteArchetypeCard` +
`RoxzoneCard`, in `components/ReportPanel.tsx`). Take a screenshot and save
it as `video/public/screenshots/sneak-peek/05-results-archetype.png`.

- [ ] **Step 8: Capture the premium paywall**

Scroll further to the `.paywall` block just after `RaceBlueprint` in
`ReportPanel.tsx` (heading "Unlock Ocht premium", button "Unlock full
report" — this account is signed in but not on an `ACTIVE` subscription, so
`canStartCheckout` is true and the button reads "Unlock full report" rather
than "Sign in to unlock"). Take a screenshot and save it as
`video/public/screenshots/sneak-peek/08-premium-unlock.png`.

- [ ] **Step 9: Verify and commit**

```bash
ls video/public/screenshots/sneak-peek/
```

Expected: `02-strava-connect.png`, `03-format-picker.png`,
`04-split-form.png`, `05-results-archetype.png`, `08-premium-unlock.png` all
present, non-zero size.

```bash
git add video/public/screenshots/sneak-peek/02-strava-connect.png video/public/screenshots/sneak-peek/03-format-picker.png video/public/screenshots/sneak-peek/04-split-form.png video/public/screenshots/sneak-peek/05-results-archetype.png video/public/screenshots/sneak-peek/08-premium-unlock.png
git commit -m "Capture onboarding, format-picker, split-form, archetype, and paywall screenshots for sneak-peek video"
```

---

### Task 4: Capture screenshots — premium account (full leaks, training + simulator)

**Files:**
- Create: `video/public/screenshots/sneak-peek/06-blueprint-leaks.png`
- Create: `video/public/screenshots/sneak-peek/07-training-simulator.png`

These two beats intentionally show the *unlocked* payoff (full ranked leak
list, target simulator, four-week focus), so they're captured on the seeded
`jordan.competitive@ocht.dev` account, which per `prisma/seed-dev.ts` /
`README.md` already has an `ACTIVE` subscription and 6 saved HYROX reports —
no Stripe checkout needed locally.

Continues from Task 3 (dev server running, 390x844 viewport). First log the
throwaway account out.

- [ ] **Step 1: Seed the dev database if not already done**

```bash
npx prisma migrate deploy
npx tsx prisma/seed-dev.ts
```

(Safe to re-run — wipes and recreates the 4 seed accounts.)

- [ ] **Step 2: Log in as the premium seed account**

Open the account menu, click **"Log in"**, and sign in with:
- Email: `jordan.competitive@ocht.dev`
- Password: `OchtDevPass123!`

- [ ] **Step 3: Open the most recent saved report**

Switch to the **"Progress"** tab (`tab-bar__label`), open the most recent
report from `ReportHistory` to render it in `ReportPanel`.

- [ ] **Step 4: Capture the full leak list + race blueprint**

Scroll to `#report-leaks` (`visibleLeaks` — shows the *full* list since
`fullReportUnlocked` is true for this account) together with the
`RaceBlueprint` component just below it. Take a screenshot and save it as
`video/public/screenshots/sneak-peek/06-blueprint-leaks.png`.

- [ ] **Step 5: Capture training + target simulator**

Scroll to `#report-training`. Expand the **"Target simulator"** section
(click its `<summary>` — `<strong>View</strong>`) so `TargetSimulator` is
visible alongside the "Training diagnosis" and "Four-week focus" content
already open by default. Take a screenshot and save it as
`video/public/screenshots/sneak-peek/07-training-simulator.png`.

- [ ] **Step 6: Verify, stop the dev server, and commit**

```bash
ls video/public/screenshots/sneak-peek/
```

Expected: all 8 files now present in `video/public/screenshots/sneak-peek/`.

Stop the background `npm run dev` process started in Task 2.

```bash
git add video/public/screenshots/sneak-peek/06-blueprint-leaks.png video/public/screenshots/sneak-peek/07-training-simulator.png
git commit -m "Capture premium leak-list and training/simulator screenshots for sneak-peek video"
```

---

### Task 5: Shared beat data (`sneakPeekBeats.ts`)

**Files:**
- Create: `video/src/sneakPeekBeats.ts`

- [ ] **Step 1: Create `video/src/sneakPeekBeats.ts`**

```ts
export type SneakPeekBeat = {
  id: string;
  screenshot: string;
  caption: string;
  durationInFrames: number;
};

export const SNEAK_PEEK_BOOKEND_FRAMES = 60;

export const sneakPeekBeats: SneakPeekBeat[] = [
  {
    id: "hero",
    screenshot: "screenshots/sneak-peek/01-hero.png",
    caption: "Know exactly where you lose time",
    durationInFrames: 90,
  },
  {
    id: "strava-connect",
    screenshot: "screenshots/sneak-peek/02-strava-connect.png",
    caption: "Connect Strava",
    durationInFrames: 90,
  },
  {
    id: "format-picker",
    screenshot: "screenshots/sneak-peek/03-format-picker.png",
    caption: "Hyrox. Tryka. Or build your own.",
    durationInFrames: 90,
  },
  {
    id: "split-form",
    screenshot: "screenshots/sneak-peek/04-split-form.png",
    caption: "Log your splits",
    durationInFrames: 90,
  },
  {
    id: "results-archetype",
    screenshot: "screenshots/sneak-peek/05-results-archetype.png",
    caption: "Meet your archetype",
    durationInFrames: 120,
  },
  {
    id: "blueprint-leaks",
    screenshot: "screenshots/sneak-peek/06-blueprint-leaks.png",
    caption: "Find your leaks",
    durationInFrames: 120,
  },
  {
    id: "training-simulator",
    screenshot: "screenshots/sneak-peek/07-training-simulator.png",
    caption: "Your 4-week focus",
    durationInFrames: 90,
  },
  {
    id: "premium-unlock",
    screenshot: "screenshots/sneak-peek/08-premium-unlock.png",
    caption: "Unlock the full report",
    durationInFrames: 90,
  },
];

export const SNEAK_PEEK_TOTAL_DURATION_IN_FRAMES =
  SNEAK_PEEK_BOOKEND_FRAMES * 2 +
  sneakPeekBeats.reduce((total, beat) => total + beat.durationInFrames, 0);
```

- [ ] **Step 2: Verify the total duration is 900 frames**

```bash
echo "60*2 + (90+90+90+90+120+120+90+90) = $((60*2 + 90+90+90+90+120+120+90+90))"
```

Expected: `900`.

- [ ] **Step 3: Commit**

```bash
git add video/src/sneakPeekBeats.ts
git commit -m "Add shared beat data for sneak-peek video"
```

---

### Task 6: `KineticCaption` component

**Files:**
- Create: `video/src/KineticCaption.tsx`

- [ ] **Step 1: Create `video/src/KineticCaption.tsx`**

```tsx
import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LIME, PAPER } from "./brandMark";

const display = loadDisplayFont("normal", { weights: ["700", "900"] });

type KineticCaptionProps = {
  text: string;
};

export function KineticCaption({ text }: KineticCaptionProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, fps * 0.25, durationInFrames - fps * 0.25, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const translateY = interpolate(frame, [0, fps * 0.25], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "8%",
        display: "flex",
        justifyContent: "center",
        padding: "0 6%",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          fontFamily: display.fontFamily,
          fontWeight: 900,
          fontSize: 56,
          lineHeight: 1.1,
          textAlign: "center",
          color: LIME,
          textShadow: `0 4px 24px ${PAPER}`,
        }}
      >
        {text}
      </span>
    </div>
  );
}
```

This has no standalone visual test (it renders no background of its own) —
it's verified together with `SneakPeekScene` in Task 7.

- [ ] **Step 2: Commit**

```bash
git add video/src/KineticCaption.tsx
git commit -m "Add KineticCaption component for sneak-peek video"
```

---

### Task 7: `SneakPeekScene` component (full-bleed screenshot + Ken Burns + caption)

**Files:**
- Create: `video/src/SneakPeekScene.tsx`
- Modify: `video/src/Root.tsx` (temporary test wiring, reverted at end of task)

- [ ] **Step 1: Create `video/src/SneakPeekScene.tsx`**

```tsx
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { KineticCaption } from "./KineticCaption";
import { PAPER } from "./brandMark";

type SneakPeekSceneProps = {
  screenshot: string;
  caption: string;
};

export function SneakPeekScene({ screenshot, caption }: SneakPeekSceneProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, durationInFrames], [0, -16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      <Img
        src={staticFile(screenshot)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "top center",
          transform: `scale(${scale}) translateY(${translateY}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, ${PAPER}f2 0%, ${PAPER}00 32%)`,
        }}
      />
      <KineticCaption text={caption} />
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Temporarily wire it into the `InstagramReveal` composition slot for a smoke test**

`InstagramReveal` is the only currently-registered 1080-wide composition, so
it's the fastest way to smoke-test `SneakPeekScene` before
`SneakPeekVideo.tsx` exists. In `video/src/Root.tsx`, temporarily add the
import `import { SneakPeekScene } from "./SneakPeekScene";` and change the
`InstagramReveal` composition's `component` prop to:

```tsx
component={() => (
  <SneakPeekScene
    screenshot="screenshots/sneak-peek/01-hero.png"
    caption="Know exactly where you lose time"
  />
)}
```

- [ ] **Step 3: Render a still to verify**

```bash
npx remotion still src/index.ts InstagramReveal out/scene-check.png --frame=40
```

Read the PNG. Expected: the real hero screenshot fills the frame
(cropped/cover, top-anchored), a dark gradient scrim sits over the bottom
third, and the bold lime caption "Know exactly where you lose time" is
visible near the bottom.

- [ ] **Step 4: Revert the temporary `Root.tsx` change**

Change `Root.tsx`'s `InstagramReveal` composition back to
`component={InstagramReveal}` and remove the temporary `SneakPeekScene`
import.

```bash
rm -f out/scene-check.png
```

- [ ] **Step 5: Commit**

```bash
git add video/src/SneakPeekScene.tsx
git commit -m "Add SneakPeekScene component with Ken Burns motion and kinetic caption"
```

---

### Task 8: `RevealBookend` component (intro/outro)

**Files:**
- Create: `video/src/RevealBookend.tsx`

- [ ] **Step 1: Create `video/src/RevealBookend.tsx`**

```tsx
import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/DMMono";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { LIME, MUTED, PAPER, ShieldMark } from "./brandMark";

const display = loadDisplayFont("normal", { weights: ["900"] });
const mono = loadMonoFont("normal", { weights: ["400"] });

const SHIELD_SIZE = 150;

type RevealBookendProps = {
  mode: "intro" | "outro";
};

export function RevealBookend({ mode }: RevealBookendProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const shieldOpacity =
    mode === "intro"
      ? interpolate(frame, [0, durationInFrames * 0.7], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const shieldScale =
    mode === "intro"
      ? interpolate(frame, [0, durationInFrames * 0.7], [0.85, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const glowOpacity =
    mode === "intro"
      ? interpolate(frame, [0, durationInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const taglineOpacity =
    mode === "outro"
      ? interpolate(frame, [durationInFrames * 0.3, durationInFrames * 0.8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <AbsoluteFill
      style={{
        background: PAPER,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${LIME}55 0%, ${LIME}00 70%)`,
          filter: "blur(50px)",
          opacity: glowOpacity,
        }}
      />
      <ShieldMark
        size={SHIELD_SIZE}
        displayFontFamily={display.fontFamily}
        opacity={shieldOpacity}
        scale={shieldScale}
      />
      {mode === "outro" ? (
        <p
          style={{
            marginTop: 32,
            fontFamily: mono.fontFamily,
            fontWeight: 400,
            fontSize: 22,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: MUTED,
            opacity: taglineOpacity,
          }}
        >
          ocht.app
        </p>
      ) : null}
    </AbsoluteFill>
  );
}
```

This is smoke-tested together with the full composition in Task 9 (no
standalone `Composition` entry is worth adding just for this).

- [ ] **Step 2: Commit**

```bash
git add video/src/RevealBookend.tsx
git commit -m "Add RevealBookend component for sneak-peek intro/outro"
```

---

### Task 9: `SneakPeekVideo` composition (sequences bookends + all 8 beats)

**Files:**
- Create: `video/src/SneakPeekVideo.tsx`
- Modify: `video/src/Root.tsx`

- [ ] **Step 1: Create `video/src/SneakPeekVideo.tsx`**

```tsx
import { AbsoluteFill, Sequence } from "remotion";
import { PAPER } from "./brandMark";
import { RevealBookend } from "./RevealBookend";
import { SneakPeekScene } from "./SneakPeekScene";
import { SNEAK_PEEK_BOOKEND_FRAMES, sneakPeekBeats } from "./sneakPeekBeats";

export function SneakPeekVideo() {
  let cursor = 0;
  const introFrom = cursor;
  cursor += SNEAK_PEEK_BOOKEND_FRAMES;

  const beatSequences = sneakPeekBeats.map((beat) => {
    const from = cursor;
    cursor += beat.durationInFrames;
    return { beat, from };
  });

  const outroFrom = cursor;

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Sequence from={introFrom} durationInFrames={SNEAK_PEEK_BOOKEND_FRAMES}>
        <RevealBookend mode="intro" />
      </Sequence>
      {beatSequences.map(({ beat, from }) => (
        <Sequence key={beat.id} from={from} durationInFrames={beat.durationInFrames}>
          <SneakPeekScene screenshot={beat.screenshot} caption={beat.caption} />
        </Sequence>
      ))}
      <Sequence from={outroFrom} durationInFrames={SNEAK_PEEK_BOOKEND_FRAMES}>
        <RevealBookend mode="outro" />
      </Sequence>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Register both compositions in `video/src/Root.tsx`**

Replace `video/src/Root.tsx` with:

```tsx
import { Composition } from "remotion";
import { InstagramReveal, INSTAGRAM_REVEAL_DURATION_IN_FRAMES } from "./InstagramReveal";
import { OchtDemo, TOTAL_DURATION_IN_FRAMES } from "./OchtDemo";
import { SneakPeekVideo } from "./SneakPeekVideo";
import { SNEAK_PEEK_TOTAL_DURATION_IN_FRAMES } from "./sneakPeekBeats";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="OchtDemo"
        component={OchtDemo}
        durationInFrames={TOTAL_DURATION_IN_FRAMES}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="InstagramReveal"
        component={InstagramReveal}
        durationInFrames={INSTAGRAM_REVEAL_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="InstagramSneakPeekVertical"
        component={SneakPeekVideo}
        durationInFrames={SNEAK_PEEK_TOTAL_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="InstagramSneakPeekSquare"
        component={SneakPeekVideo}
        durationInFrames={SNEAK_PEEK_TOTAL_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1080}
      />
    </>
  );
};
```

- [ ] **Step 3: Render stills at each beat boundary for the vertical composition**

```bash
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-00-intro.png --frame=30
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-01-hero.png --frame=100
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-02-strava.png --frame=190
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-03-format.png --frame=280
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-04-splits.png --frame=370
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-05-archetype.png --frame=470
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-06-leaks.png --frame=590
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-07-training.png --frame=700
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-08-premium.png --frame=790
npx remotion still src/index.ts InstagramSneakPeekVertical out/v-09-outro.png --frame=870
```

Read all ten PNGs. Expected: frame 30 shows the shield fading in on the dark
background (no ring, no caption); frames 100–790 each show the matching
screenshot full-bleed at 1080x1920 with its caption visible near the bottom
and no other beat's content bleeding in; frame 870 shows the settled shield
plus the "ocht.app" tagline. If a beat's screenshot looks wrong (wrong UI
state, empty, cropped so the key element is missing), go back to the
relevant capture task (2–4), recapture that one screenshot, and re-run this
step.

- [ ] **Step 4: Render one still for the square composition to confirm the crop**

```bash
npx remotion still src/index.ts InstagramSneakPeekSquare out/s-05-archetype.png --frame=470
```

Read the PNG. Expected: same beat, same caption, but cropped to 1080x1080 —
confirm the archetype card isn't cropped out of frame (this is the risk
flagged in the design doc). If it is, note it — a per-composition crop
override is a follow-up, not blocking this plan.

- [ ] **Step 5: Clean up check stills and commit**

```bash
rm -f out/v-*.png out/s-*.png
git add video/src/SneakPeekVideo.tsx video/src/Root.tsx
git commit -m "Sequence sneak-peek beats into InstagramSneakPeekVertical and InstagramSneakPeekSquare compositions"
```

---

### Task 10: Render scripts and final render

**Files:**
- Modify: `video/package.json`

- [ ] **Step 1: Add render/still scripts**

In `video/package.json`, update the `scripts` block to:

```json
"scripts": {
  "render": "remotion render src/index.ts OchtDemo out/ocht-demo.mp4",
  "still": "remotion still src/index.ts OchtDemo out/still.png",
  "render:ig": "remotion render src/index.ts InstagramReveal out/ocht-instagram-reveal.mp4",
  "still:ig": "remotion still src/index.ts InstagramReveal out/ig-still.png",
  "render:ig-vertical": "remotion render src/index.ts InstagramSneakPeekVertical out/ocht-sneak-peek-vertical.mp4",
  "render:ig-square": "remotion render src/index.ts InstagramSneakPeekSquare out/ocht-sneak-peek-square.mp4",
  "still:ig-vertical": "remotion still src/index.ts InstagramSneakPeekVertical out/sneak-peek-vertical-still.png",
  "still:ig-square": "remotion still src/index.ts InstagramSneakPeekSquare out/sneak-peek-square-still.png"
}
```

- [ ] **Step 2: Render both final videos**

```bash
npm run render:ig-vertical
npm run render:ig-square
```

Expected: both complete without error, producing
`video/out/ocht-sneak-peek-vertical.mp4` and
`video/out/ocht-sneak-peek-square.mp4`, each ~900 frames at 30fps (~30s),
H.264 MP4.

- [ ] **Step 3: Commit the script addition**

```bash
git add video/package.json
git commit -m "Add render/still scripts for sneak-peek video compositions"
```

- [ ] **Step 4: Report completion**

No commit for the rendered `.mp4` files (`video/out/` is gitignored). Tell
the user both files are ready at `video/out/ocht-sneak-peek-vertical.mp4`
and `video/out/ocht-sneak-peek-square.mp4`, and that either can be
regenerated any time via `npm run render:ig-vertical` /
`npm run render:ig-square` from `video/` after adjusting captions, timing,
or screenshots.
