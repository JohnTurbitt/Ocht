# Ocht Demo Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `video/out/ocht-demo.mp4`, a ~90 second 1920x1080 demo video
of the Ocht app, built from real screenshots of the running app assembled
with motion and captions in a standalone Remotion project.

**Architecture:** A new `video/` directory containing an independent Remotion
project (own `package.json`). Two reusable scene components (`LogoScene` for
brand bookends, `Scene` for screenshot scenes with a phone-frame + Ken Burns
motion + caption) are sequenced with `@remotion/transitions` crossfades in
`OchtDemo.tsx`. Real screenshots are captured from `npm run dev` via the
chrome-devtools browser tool at a 390x844 mobile viewport and saved into
`video/public/screenshots/`.

**Tech Stack:** Remotion 4 (`remotion`, `@remotion/cli`, `@remotion/transitions`,
`@remotion/google-fonts`), React 19, TypeScript. Screenshot capture via the
chrome-devtools MCP tool against the existing Next.js dev server
(`npm run dev`, port 3002).

---

## Reference: design tokens used throughout

```ts
// colors (dark theme, matches styles/_base.scss)
lime:     "#c8ff2e"
panel:    "#0e1914"
surface:  "#14241d"
ink:      "#f4f7ef"
line:     "#284237"
teal:     "#60c878"
badgeInk: "#0b120f"

// fonts (Google Fonts, loaded via @remotion/google-fonts)
display: "Saira Condensed" (weights 700, 900)
mono:    "DM Mono" (weight 500)
```

## Reference: final scene sequence (30fps)

| # | Component | duration (frames) | screenshot | caption |
|---|-----------|--------------------|------------|---------|
| 1 | LogoScene | 120 | — | (none) |
| 2 | Scene | 210 | `screenshots/02-hero.png` | "Race split analysis for hybrid athletes" |
| 3 | Scene | 240 | `screenshots/03-format-picker.png` | "Pick your race format" |
| 4 | Scene | 240 | `screenshots/04-split-form.png` | "Enter your run & station splits" |
| 5 | Scene | 120 | `screenshots/05-generating.png` | "Instant analysis" |
| 6 | Scene | 240 | `screenshots/06-results-reveal.png` | "Get your results instantly" |
| 7 | Scene | 300 | `screenshots/07-race-flow.png` | "See your race flow, archetype & roxzone tax" |
| 8 | Scene | 240 | `screenshots/08-leaks.png` | "Find your biggest time leaks" |
| 9 | Scene | 240 | `screenshots/09-training.png` | "Get a 4-week training focus" |
| 10 | Scene | 240 | `screenshots/10-simulator.png` | "Simulate a faster finish" |
| 11 | Scene | 240 | `screenshots/11-progress.png` | "Track progress across races" |
| 12 | Scene | 180 | `screenshots/12-premium.png` | "Unlock the full report with Ocht Premium" |
| 13 | LogoScene (tagline) | 150 | — | "Train smarter, race faster" |

Transitions are 12-frame fades between every pair of scenes. Total
composition length = `sum(durations) - 12 * 12 = 2760 - 144 = 2616` frames
(~87s at 30fps).

---

### Task 1: Scaffold the Remotion project

**Files:**
- Create: `video/package.json`
- Create: `video/tsconfig.json`
- Create: `video/remotion.config.ts`
- Create: `video/src/index.ts`
- Create: `video/src/Root.tsx`
- Create: `video/src/OchtDemo.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: Create `video/package.json`**

```json
{
  "name": "ocht-demo-video",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "render": "remotion render src/index.ts OchtDemo out/ocht-demo.mp4",
    "still": "remotion still src/index.ts OchtDemo out/still.png"
  },
  "dependencies": {
    "@remotion/cli": "^4.0.0",
    "@remotion/google-fonts": "^4.0.0",
    "@remotion/transitions": "^4.0.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "remotion": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Create `video/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `video/remotion.config.ts`**

```ts
import { Config } from "@remotion/cli/config";

Config.setOverwriteOutput(true);
```

- [ ] **Step 4: Install dependencies**

Run (from `video/`):

```bash
npm install
```

Expected: completes without error, creates `video/node_modules` and
`video/package-lock.json`.

- [ ] **Step 5: Create `video/src/OchtDemo.tsx` (placeholder)**

```tsx
import { AbsoluteFill } from "remotion";

export function OchtDemo() {
  return <AbsoluteFill style={{ backgroundColor: "#0e1914" }} />;
}

export const TOTAL_DURATION_IN_FRAMES = 150;
```

- [ ] **Step 6: Create `video/src/Root.tsx`**

```tsx
import { Composition } from "remotion";
import { OchtDemo, TOTAL_DURATION_IN_FRAMES } from "./OchtDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="OchtDemo"
      component={OchtDemo}
      durationInFrames={TOTAL_DURATION_IN_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
```

- [ ] **Step 7: Create `video/src/index.ts`**

```ts
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
```

- [ ] **Step 8: Render a still to verify the toolchain works**

Run (from `video/`):

```bash
npx remotion still src/index.ts OchtDemo out/test-still.png --frame=0
```

Expected: prints a "Rendered still" success message and creates
`video/out/test-still.png`. Read the PNG to confirm it's a solid dark green
(`#0e1914`) 1920x1080 frame.

- [ ] **Step 9: Update `.gitignore`**

Add these lines to `C:\Users\johnt\Documents\Ocht\.gitignore`:

```
video/node_modules
video/out
```

- [ ] **Step 10: Commit**

```bash
git add video/package.json video/package-lock.json video/tsconfig.json video/remotion.config.ts video/src/index.ts video/src/Root.tsx video/src/OchtDemo.tsx .gitignore
git commit -m "Scaffold Remotion project for Ocht demo video"
```

---

### Task 2: Shared theme tokens

**Files:**
- Create: `video/src/theme.ts`
- Modify: `video/src/OchtDemo.tsx`

- [ ] **Step 1: Create `video/src/theme.ts`**

```ts
import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/DMMono";

const display = loadDisplayFont("normal", { weights: ["700", "900"] });
const mono = loadMonoFont("normal", { weights: ["500"] });

export const fonts = {
  display: display.fontFamily,
  mono: mono.fontFamily,
} as const;

export const colors = {
  lime: "#c8ff2e",
  panel: "#0e1914",
  surface: "#14241d",
  ink: "#f4f7ef",
  line: "#284237",
  teal: "#60c878",
  badgeInk: "#0b120f",
} as const;
```

- [ ] **Step 2: Update `video/src/OchtDemo.tsx` to use the theme**

```tsx
import { AbsoluteFill } from "remotion";
import { colors } from "./theme";

export function OchtDemo() {
  return <AbsoluteFill style={{ backgroundColor: colors.panel }} />;
}

export const TOTAL_DURATION_IN_FRAMES = 150;
```

- [ ] **Step 3: Re-render the still and verify**

```bash
npx remotion still src/index.ts OchtDemo out/test-still.png --frame=0
```

Expected: succeeds. If it fails with a font-loading network error, edit
`theme.ts` to replace the `@remotion/google-fonts` imports with plain string
fallbacks (`display: '"Arial Narrow", sans-serif'`, `mono: '"Courier New", monospace'`)
and re-run — note this fallback in the commit message if used.

- [ ] **Step 4: Commit**

```bash
git add video/src/theme.ts video/src/OchtDemo.tsx
git commit -m "Add shared theme tokens for Ocht demo video"
```

---

### Task 3: LogoScene component (brand bookends)

**Files:**
- Create: `video/src/LogoScene.tsx`
- Modify: `video/src/OchtDemo.tsx`

- [ ] **Step 1: Create `video/src/LogoScene.tsx`**

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts } from "./theme";

type LogoSceneProps = {
  tagline?: string;
};

export function LogoScene({ tagline }: LogoSceneProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const shieldScale = interpolate(frame, [0, fps * 0.6], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shieldOpacity = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordmarkOpacity = interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(
    frame,
    [fps * 0.9, fps * 1.4, durationInFrames - fps * 0.3, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: colors.panel,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <svg
        width={120}
        height={Math.round((120 * 78) / 64)}
        viewBox="0 0 64 78"
        fill="none"
        style={{
          transform: `scale(${shieldScale})`,
          opacity: shieldOpacity,
        }}
      >
        <path
          d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
          fill={colors.lime}
        />
        <text
          x="32"
          y="56"
          textAnchor="middle"
          fontFamily={fonts.display}
          fontWeight={900}
          fontSize={46}
          fill={colors.badgeInk}
        >
          8
        </text>
      </svg>
      <div
        style={{
          marginTop: 24,
          fontFamily: fonts.display,
          fontSize: 64,
          fontWeight: 700,
          color: colors.ink,
          opacity: wordmarkOpacity,
        }}
      >
        ocht<span style={{ color: colors.teal }}>.</span>
      </div>
      {tagline ? (
        <div
          style={{
            marginTop: 16,
            fontFamily: fonts.mono,
            fontSize: 28,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: colors.ink,
            opacity: taglineOpacity,
          }}
        >
          {tagline}
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Render `LogoScene` in `OchtDemo.tsx` for testing**

```tsx
import { AbsoluteFill } from "remotion";
import { LogoScene } from "./LogoScene";
import { colors } from "./theme";

export function OchtDemo() {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.panel }}>
      <LogoScene tagline="Train smarter, race faster" />
    </AbsoluteFill>
  );
}

export const TOTAL_DURATION_IN_FRAMES = 150;
```

- [ ] **Step 3: Render stills at three frames to verify the animation stages**

```bash
npx remotion still src/index.ts OchtDemo out/logo-frame-0.png --frame=0
npx remotion still src/index.ts OchtDemo out/logo-frame-30.png --frame=30
npx remotion still src/index.ts OchtDemo out/logo-frame-149.png --frame=149
```

Read all three PNGs. Expected: frame 0 is blank/empty shield fading in;
frame 30 shows the lime shield with "8" and the "ocht." wordmark fading in;
frame 149 shows the full logo plus the "TRAIN SMARTER, RACE FASTER" tagline
in DM Mono.

- [ ] **Step 4: Commit**

```bash
git add video/src/LogoScene.tsx video/src/OchtDemo.tsx
git commit -m "Add LogoScene for Ocht demo video bookends"
```

---

### Task 4: Scene component (phone frame, Ken Burns motion, caption)

**Files:**
- Create: `video/src/Scene.tsx`
- Modify: `video/src/OchtDemo.tsx`

This task builds `Scene` with a placeholder fill (showing the intended
screenshot filename as text) so it can be fully tested before real
screenshots exist. Task 10 swaps the placeholder for the real image.

- [ ] **Step 1: Create `video/src/Scene.tsx`**

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts } from "./theme";

type SceneProps = {
  screenshot: string;
  caption?: string;
};

export function Scene({ screenshot, caption }: SceneProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, durationInFrames], [0, -20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const captionOpacity = interpolate(
    frame,
    [0, fps * 0.5, durationInFrames - fps * 0.5, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const captionTranslate = interpolate(frame, [0, fps * 0.5], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 30%, ${colors.surface} 0%, ${colors.panel} 70%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 360,
          height: 780,
          borderRadius: 48,
          border: `6px solid ${colors.line}`,
          overflow: "hidden",
          boxShadow: `0 0 120px ${colors.lime}33`,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          background: colors.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.mono,
          color: colors.line,
          fontSize: 18,
          textAlign: "center",
          padding: 24,
        }}
      >
        {screenshot}
      </div>
      {caption ? (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            textAlign: "center",
            opacity: captionOpacity,
            transform: `translateY(${captionTranslate}px)`,
          }}
        >
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 48,
              fontWeight: 700,
              color: colors.ink,
              background: `${colors.panel}cc`,
              padding: "12px 32px",
              borderRadius: 12,
              border: `1px solid ${colors.lime}55`,
            }}
          >
            {caption}
          </span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Render `Scene` in `OchtDemo.tsx` for testing**

```tsx
import { AbsoluteFill } from "remotion";
import { Scene } from "./Scene";
import { colors } from "./theme";

export function OchtDemo() {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.panel }}>
      <Scene
        screenshot="screenshots/02-hero.png"
        caption="Race split analysis for hybrid athletes"
      />
    </AbsoluteFill>
  );
}

export const TOTAL_DURATION_IN_FRAMES = 210;
```

- [ ] **Step 3: Render stills at frame 0, 100, and 209**

```bash
npx remotion still src/index.ts OchtDemo out/scene-frame-0.png --frame=0
npx remotion still src/index.ts OchtDemo out/scene-frame-100.png --frame=100
npx remotion still src/index.ts OchtDemo out/scene-frame-209.png --frame=209
```

Read all three PNGs. Expected: a rounded phone-frame placeholder slowly
zooms/pans (frame 209 is slightly larger/shifted vs frame 0); the caption
"Race split analysis for hybrid athletes" fades in by frame 15 and fades out
near frame 209.

- [ ] **Step 4: Commit**

```bash
git add video/src/Scene.tsx video/src/OchtDemo.tsx
git commit -m "Add Scene component with Ken Burns motion and captions"
```

---

### Task 5: Full scene sequence with crossfade transitions

**Files:**
- Modify: `video/src/OchtDemo.tsx`

- [ ] **Step 1: Replace `video/src/OchtDemo.tsx` with the full 13-scene sequence**

```tsx
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { LogoScene } from "./LogoScene";
import { Scene } from "./Scene";
import { colors } from "./theme";

const TRANSITION_FRAMES = 12;

type SceneDefinition = {
  element: JSX.Element;
  durationInFrames: number;
};

const scenes: SceneDefinition[] = [
  { element: <LogoScene />, durationInFrames: 120 },
  {
    element: (
      <Scene
        screenshot="screenshots/02-hero.png"
        caption="Race split analysis for hybrid athletes"
      />
    ),
    durationInFrames: 210,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/03-format-picker.png"
        caption="Pick your race format"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/04-split-form.png"
        caption="Enter your run & station splits"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/05-generating.png"
        caption="Instant analysis"
      />
    ),
    durationInFrames: 120,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/06-results-reveal.png"
        caption="Get your results instantly"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/07-race-flow.png"
        caption="See your race flow, archetype & roxzone tax"
      />
    ),
    durationInFrames: 300,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/08-leaks.png"
        caption="Find your biggest time leaks"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/09-training.png"
        caption="Get a 4-week training focus"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/10-simulator.png"
        caption="Simulate a faster finish"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/11-progress.png"
        caption="Track progress across races"
      />
    ),
    durationInFrames: 240,
  },
  {
    element: (
      <Scene
        screenshot="screenshots/12-premium.png"
        caption="Unlock the full report with Ocht Premium"
      />
    ),
    durationInFrames: 180,
  },
  {
    element: <LogoScene tagline="Train smarter, race faster" />,
    durationInFrames: 150,
  },
];

export const TOTAL_DURATION_IN_FRAMES =
  scenes.reduce((total, scene) => total + scene.durationInFrames, 0) -
  TRANSITION_FRAMES * (scenes.length - 1);

export function OchtDemo() {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.panel }}>
      <TransitionSeries>
        {scenes.flatMap((scene, index) => {
          const items = [
            <TransitionSeries.Sequence
              key={`scene-${index}`}
              durationInFrames={scene.durationInFrames}
            >
              {scene.element}
            </TransitionSeries.Sequence>,
          ];

          if (index < scenes.length - 1) {
            items.push(
              <TransitionSeries.Transition
                key={`transition-${index}`}
                presentation={fade()}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
            );
          }

          return items;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Render the full placeholder video**

```bash
npm run render
```

Expected: completes without error and creates `video/out/ocht-demo.mp4`.
`TOTAL_DURATION_IN_FRAMES` is `2760 - 12*12 = 2616` frames (~87s at 30fps);
the render log should report this frame count.

- [ ] **Step 3: Spot-check a couple of stills from the full composition**

```bash
npx remotion still src/index.ts OchtDemo out/check-scene2.png --frame=130
npx remotion still src/index.ts OchtDemo out/check-scene7.png --frame=1300
```

Read both PNGs. Expected: frame 130 shows scene 2 ("02-hero.png" placeholder
+ hero caption); frame 1300 shows scene 7 ("07-race-flow.png" placeholder +
its caption). Both should show a clean crossfade with no overlapping text or
flashing.

- [ ] **Step 4: Commit**

```bash
git add video/src/OchtDemo.tsx
git commit -m "Sequence all 13 scenes with crossfade transitions"
```

---

### Task 6: Capture screenshots — onboarding & split form (scenes 2-4)

**Files:**
- Create: `video/public/screenshots/02-hero.png`
- Create: `video/public/screenshots/03-format-picker.png`
- Create: `video/public/screenshots/04-split-form.png`

- [ ] **Step 1: Start the dev server**

From the repo root (`C:\Users\johnt\Documents\Ocht`), run in the background:

```bash
npm run dev
```

Wait until it logs that it's ready on `http://127.0.0.1:3002`.

- [ ] **Step 2: Open the app in a mobile viewport**

Using the chrome-devtools browser tool: open a new page, navigate to
`http://127.0.0.1:3002`, and resize the page to **390x844** (iPhone-sized
viewport — the app is mobile-first and this matches the phone-frame mockup
in `Scene.tsx`). Wait for the launch splash animation to finish (~2s) so the
hero is fully visible.

- [ ] **Step 3: Capture scene 2 — Hero**

With the hero visible (heading "Find the time leaks between your reps and
runs.", eyebrow "Hybrid race intelligence"), take a screenshot of the full
viewport and save it as `video/public/screenshots/02-hero.png`.

- [ ] **Step 4: Capture scene 3 — race format picker**

Scroll down to the "New report" workspace (the split form's race format
picker, showing the **HYROX / TRYKA 800 / TRYKA 500 / Custom** buttons) before
any data is entered. Take a screenshot and save it as
`video/public/screenshots/03-format-picker.png`.

- [ ] **Step 5: Capture scene 4 — filled split form**

Click the **"Load sample race"** button (visible in the hero or split form)
to populate the form with sample run and station splits. Scroll so the
filled-in run/station split fields are visible. Take a screenshot and save it
as `video/public/screenshots/04-split-form.png`.

- [ ] **Step 6: Verify the three files exist**

```bash
ls video/public/screenshots/
```

Expected: `02-hero.png`, `03-format-picker.png`, `04-split-form.png`, each a
non-zero-size PNG at roughly 390x844 (or the chrome-devtools tool's default
capture resolution).

- [ ] **Step 7: Commit**

```bash
git add video/public/screenshots/02-hero.png video/public/screenshots/03-format-picker.png video/public/screenshots/04-split-form.png
git commit -m "Capture onboarding and split-form screenshots for demo video"
```

---

### Task 7: Capture screenshots — generation & results reveal (scenes 5-6)

**Files:**
- Create: `video/public/screenshots/05-generating.png`
- Create: `video/public/screenshots/06-results-reveal.png`

This continues from Task 6's browser session (dev server running, sample
race loaded, 390x844 viewport). If starting fresh, repeat Task 6 steps 1-2
and step 5 (load the sample race) first.

- [ ] **Step 1: Submit the report and capture the generation overlay**

Click the **"Generate race report"** submit button. The
`ReportGenerationOverlay` appears for about 1.7 seconds before the results
reveal. Take a screenshot as soon as the overlay (spinner) is visible and
save it as `video/public/screenshots/05-generating.png`. If the overlay has
already disappeared by the time the screenshot is taken, resubmit the form
and try again — timing may take a couple of attempts.

- [ ] **Step 2: Capture the results reveal**

After the overlay completes, the `ResultsReveal` panel appears showing the
finish time count-up, readiness gauge, archetype, and top leak, with a "View
full report" button. Take a screenshot and save it as
`video/public/screenshots/06-results-reveal.png`.

- [ ] **Step 3: Verify the two files exist**

```bash
ls video/public/screenshots/
```

Expected: `05-generating.png` and `06-results-reveal.png` are present and
non-zero size.

- [ ] **Step 4: Commit**

```bash
git add video/public/screenshots/05-generating.png video/public/screenshots/06-results-reveal.png
git commit -m "Capture report generation and results reveal screenshots for demo video"
```

---

### Task 8: Capture screenshots — report deep-dive (scenes 7-10)

**Files:**
- Create: `video/public/screenshots/07-race-flow.png`
- Create: `video/public/screenshots/08-leaks.png`
- Create: `video/public/screenshots/09-training.png`
- Create: `video/public/screenshots/10-simulator.png`

This continues from Task 7 (results reveal visible). Click **"View full
report"** to dismiss the reveal and scroll to the generated report.

- [ ] **Step 1: Capture scene 7 — race flow map & profile**

Scroll to the `#report-profile` and `#race-flow-map` sections (the athlete
archetype card, roxzone card, and the "Race flow map" section, which is
expanded by default). Take a screenshot and save it as
`video/public/screenshots/07-race-flow.png`.

- [ ] **Step 2: Capture scene 8 — ranked time leaks**

Scroll to the `#report-leaks` section (ranked time leaks). As an anonymous
user only the first two leaks are visible plus an "Unlock Ocht premium"
prompt — capture this state as-is. Take a screenshot and save it as
`video/public/screenshots/08-leaks.png`.

- [ ] **Step 3: Capture scene 9 — training focus**

Scroll to the `#report-training` section. This is a premium section
(`ReportSection` with `premium`), so it renders with an "Ocht premium" badge
in its `<summary>`. Click the section's **"View"** control to expand it and
take a screenshot of the expanded section (whether it shows the full
four-week focus or an upgrade prompt — capture whatever the free-tier view
renders). Save it as `video/public/screenshots/09-training.png`.

- [ ] **Step 4: Capture scene 10 — target simulator**

Scroll to the `#report-target-path` section (Target Simulator). This is also
a premium section — expand it via **"View"** and capture whatever the
free-tier view renders. Save it as `video/public/screenshots/10-simulator.png`.

- [ ] **Step 5: Verify the four files exist**

```bash
ls video/public/screenshots/
```

Expected: `07-race-flow.png`, `08-leaks.png`, `09-training.png`,
`10-simulator.png` are present and non-zero size.

- [ ] **Step 6: Commit**

```bash
git add video/public/screenshots/07-race-flow.png video/public/screenshots/08-leaks.png video/public/screenshots/09-training.png video/public/screenshots/10-simulator.png
git commit -m "Capture report deep-dive screenshots for demo video"
```

---

### Task 9: Capture screenshots — progress dashboard & premium teaser (scenes 11-12)

**Files:**
- Create: `video/public/screenshots/11-progress.png`
- Create: `video/public/screenshots/12-premium.png`

This continues from Task 8 (report generated, still in the same browser
session).

- [ ] **Step 1: Capture scene 11 — progress dashboard**

Use the bottom tab bar to switch to the **"Progress"** tab. This shows the
`ProgressDashboard` ("Your trend") above the report history list (now
containing the just-generated sample report). Take a screenshot and save it
as `video/public/screenshots/11-progress.png`.

- [ ] **Step 2: Capture scene 12 — premium teaser**

Scroll back to the report (or use the "New report" tab) and locate the
paywall prompt — the **"Unlock Ocht premium"** button with the `PremiumBadge`
shown for non-paying users. Take a screenshot focused on this paywall card
and save it as `video/public/screenshots/12-premium.png`.

- [ ] **Step 3: Verify the two files exist**

```bash
ls video/public/screenshots/
```

Expected: `11-progress.png` and `12-premium.png` are present and non-zero
size.

- [ ] **Step 4: Stop the dev server**

Stop the background `npm run dev` process started in Task 6.

- [ ] **Step 5: Commit**

```bash
git add video/public/screenshots/11-progress.png video/public/screenshots/12-premium.png
git commit -m "Capture progress dashboard and premium teaser screenshots for demo video"
```

---

### Task 10: Wire `Scene` to render real screenshots

**Files:**
- Modify: `video/src/Scene.tsx`

- [ ] **Step 1: Replace the placeholder fill with the real screenshot image**

In `video/src/Scene.tsx`, add the `Img` and `staticFile` imports:

```tsx
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts } from "./theme";
```

Replace the phone-frame `<div>` contents — change:

```tsx
      <div
        style={{
          width: 360,
          height: 780,
          borderRadius: 48,
          border: `6px solid ${colors.line}`,
          overflow: "hidden",
          boxShadow: `0 0 120px ${colors.lime}33`,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          background: colors.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.mono,
          color: colors.line,
          fontSize: 18,
          textAlign: "center",
          padding: 24,
        }}
      >
        {screenshot}
      </div>
```

to:

```tsx
      <div
        style={{
          width: 360,
          height: 780,
          borderRadius: 48,
          border: `6px solid ${colors.line}`,
          overflow: "hidden",
          boxShadow: `0 0 120px ${colors.lime}33`,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          background: colors.surface,
        }}
      >
        <Img
          src={staticFile(screenshot)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
```

- [ ] **Step 2: Render a still using a real screenshot scene to verify**

```bash
npx remotion still src/index.ts OchtDemo out/check-real-scene.png --frame=130
```

Read `video/out/check-real-scene.png`. Expected: the phone frame now shows
the real `02-hero.png` screenshot (the Ocht hero) instead of placeholder
text, with the "Race split analysis for hybrid athletes" caption overlaid.

- [ ] **Step 3: Commit**

```bash
git add video/src/Scene.tsx
git commit -m "Render real screenshots inside the Scene phone frame"
```

---

### Task 11: Final render and review

**Files:** none (render output only)

- [ ] **Step 1: Render the final video**

```bash
npm run render
```

Expected: completes without error, overwrites `video/out/ocht-demo.mp4`
(`Config.setOverwriteOutput(true)` from Task 1), ~2616 frames at 30fps
(~87s).

- [ ] **Step 2: Spot-check stills across the full timeline**

```bash
npx remotion still src/index.ts OchtDemo out/final-0.png --frame=60
npx remotion still src/index.ts OchtDemo out/final-1.png --frame=1000
npx remotion still src/index.ts OchtDemo out/final-2.png --frame=2000
npx remotion still src/index.ts OchtDemo out/final-3.png --frame=2600
```

Read all four PNGs and confirm:
- `final-0.png` (frame 60): logo reveal scene, shield + wordmark visible.
- `final-1.png` (frame 1000): a report/results scene with its caption and
  real screenshot visible inside the phone frame.
- `final-2.png` (frame 2000): a later report scene (training/simulator/
  progress), screenshot + caption visible.
- `final-3.png` (frame 2600): closing logo scene with the "TRAIN SMARTER,
  RACE FASTER" tagline visible.

If any screenshot looks wrong (wrong UI state, cut off, premium lock instead
of expected content), go back to the relevant capture task (6-9), recapture
that one screenshot, and re-run this task's render.

- [ ] **Step 3: Clean up temporary still files**

```bash
rm -f video/out/test-still.png video/out/logo-frame-*.png video/out/scene-frame-*.png video/out/check-*.png video/out/final-*.png
```

(`video/out/` is gitignored, so this is just local tidiness.)

- [ ] **Step 4: Report completion**

No commit needed for this task (rendered output is gitignored). Tell the
user the final video is at `video/out/ocht-demo.mp4` and that they can run
`npm run render` again from `video/` any time to regenerate it after
adjusting captions, timings, or screenshots.
