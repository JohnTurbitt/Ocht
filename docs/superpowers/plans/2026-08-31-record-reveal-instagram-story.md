# Record Reveal Instagram Story Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and render an 8-second, 1080×1920 Instagram Story video (`video/out/ocht-record-reveal.mp4`) announcing the new Record button, as a Remotion composition that reuses real brand/component values (the actual `RecordBadge` shield-in-circle graphic, the actual pulse-ring keyframe math, the live page's actual background color) rather than redrawing approximations.

**Architecture:** One new Remotion composition (`RecordReveal.tsx`) registered alongside the existing `OchtDemo`/`InstagramReveal`/`SneakPeekVideo` compositions in `video/src/Root.tsx`, following that project's established pattern: a single self-contained file with inline frame-based `interpolate()` animation logic (matching `InstagramReveal.tsx`'s convention), pulling shared constants/mark components from `video/src/brandMark.tsx`, and rendered via a new `npm run render:record` script mirroring the existing `render:ig` script.

**Tech Stack:** Remotion 4 (`video/` sub-project), TypeScript, React, `@remotion/google-fonts` (DM Mono + Saira Condensed, both already used elsewhere in this project).

**Full spec:** `docs/superpowers/specs/2026-08-31-record-reveal-instagram-story-design.md`

**One confirmed deviation from the spec, discovered while planning:** the spec's Visual Treatment section describes the countdown digits as "weight 700–800 for punch," but the installed `@remotion/google-fonts/DMMono` package only ships weights 300/400/500 (confirmed by inspecting `video/node_modules/@remotion/google-fonts/dist/cjs/DMMono.js`, which lists `300;400;500` for both italic and normal — no 700/800 exists to load). This plan uses weight `500` (the heaviest available) instead. This is a real font-catalog constraint, not a guess.

---

### Task 1: Add the `RecordMark` component and live-panel constants to `video/src/brandMark.tsx`

**Files:**
- Modify: `video/src/brandMark.tsx`

This mirrors `components/RecordBadge.tsx` (the real in-app component) and `styles/_record-badge.scss` exactly — same gradient, same shield path/fill/stroke, same glyph position — as a new export alongside the existing `ShieldMark`/`RingMark`. It is a distinct component from `ShieldMark` because the real `RecordBadge` is visually different (a filled gradient circle containing a translucent shield outline) from the plain solid-lime `ShieldMark` used in the logo-reveal video.

- [ ] **Step 1: Add the new constants and component**

Append to the end of `video/src/brandMark.tsx` (after the existing `RingMark` function):

```tsx
export const LIVE_PANEL = "#0e1914";
export const RECORD_BADGE_GRADIENT =
  "radial-gradient(circle at 35% 30%, #d8ff6a, #b6ef00 60%, #94c700 100%)";
export const RECORD_BADGE_SHIELD_FILL = "rgba(14, 25, 20, 0.08)";
export const RECORD_BADGE_INK = "#0e1914";

type RecordMarkProps = {
  size: number;
  displayFontFamily: string;
  opacity?: number;
  scale?: number;
};

export function RecordMark({
  size,
  displayFontFamily,
  opacity = 1,
  scale = 1,
}: RecordMarkProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: RECORD_BADGE_GRADIENT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 64 78" fill="none">
        <path
          d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
          fill={RECORD_BADGE_SHIELD_FILL}
          stroke={RECORD_BADGE_INK}
          strokeWidth={2}
        />
        <text
          x="32"
          y="52"
          textAnchor="middle"
          fontFamily={displayFontFamily}
          fontWeight={900}
          fontSize={34}
          fill={RECORD_BADGE_INK}
        >
          8
        </text>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verify types check**

Run (from `video/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add video/src/brandMark.tsx
git commit -m "Add RecordMark brand component for the Record Reveal video"
```

---

### Task 2: Create `video/src/RecordReveal.tsx` — the composition

**Files:**
- Create: `video/src/RecordReveal.tsx`

Implements the full 240-frame (8.0s @ 30fps) timeline from the spec's shot list: intro (pulsing badge + headline + dimmed nav sliver), tap flourish, 3-2-1-GO countdown, end card. All animation is frame-based `interpolate()` math (Remotion renders frame-by-frame, not live CSS), following `InstagramReveal.tsx`'s established single-file convention.

- [ ] **Step 1: Write the composition**

Create `video/src/RecordReveal.tsx`:

```tsx
import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SairaCondensed";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/DMMono";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LIME, LIVE_PANEL, MUTED, RecordMark } from "./brandMark";

const display = loadDisplayFont("normal", { weights: ["900"] });
const mono = loadMonoFont("normal", { weights: ["500"] });

const BADGE_SIZE = 220;
const TAP_START = 108;
const TAP_END = 120;
const COUNT_3_END = 138;
const COUNT_2_END = 156;
const COUNT_1_END = 174;
const GO_END = 192;

const TAB_LABELS = ["New", "Progress", "Record", "Compare", "Records"];

// Ports styles/_layout.scss's `tab-bar-record-pulse` keyframe (scale 1 -> 1.55,
// opacity 0.7 -> 0, 2.2s ease-out, infinite, two rings staggered 0.7s) into
// frame-based interpolation, since Remotion renders frame-by-frame rather
// than running live CSS animation. Easing.out(Easing.quad) approximates the
// CSS `ease-out` timing function closely enough for this decorative motion.
function pulseRing(frame: number, delayFrames: number, periodFrames: number) {
  const local = frame - delayFrames;
  if (local < 0) {
    return { scale: 1, opacity: 0 };
  }
  const t = (local % periodFrames) / periodFrames;
  const eased = Easing.out(Easing.quad)(t);
  return { scale: 1 + eased * 0.55, opacity: 0.7 * (1 - eased) };
}

function CountdownLabel({
  text,
  color,
  fontSize,
  fontFamily,
  localFrame,
  segmentFrames,
}: {
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  localFrame: number;
  segmentFrames: number;
}) {
  const scale = interpolate(localFrame, [0, segmentFrames * 0.4], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.7)),
  });
  const opacity = interpolate(localFrame, [0, segmentFrames * 0.25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <p
      style={{
        margin: 0,
        fontFamily,
        fontWeight: 500,
        fontSize,
        color,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {text}
    </p>
  );
}

export function RecordReveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ringPeriodFrames = Math.round(2.2 * fps);
  const ringStaggerFrames = Math.round(0.7 * fps);

  const introOpacity = interpolate(frame, [0, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headlineOpacity = interpolate(frame, [36, 54, 96, 108], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const sceneVisible = frame < TAP_END;
  // The real RecordBadge/tab-bar__record has no :active press state today —
  // tapping it just navigates. This scale-down/up + white tap-dot flourish
  // is a deliberate addition for THIS VIDEO ONLY, purely so a static tap
  // reads as "pressed" on video; it does not reflect real app behavior. See
  // the "Deliberate non-parity" section of the design spec.
  const tapVisible = frame >= TAP_START && frame < TAP_END;
  const tapProgress = tapVisible ? (frame - TAP_START) / (TAP_END - TAP_START) : 0;
  const tapDotScale = interpolate(tapProgress, [0, 0.5, 1], [1.4, 1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tapDotOpacity = interpolate(tapProgress, [0, 0.2, 1], [0, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeScale = interpolate(
    frame,
    [TAP_START, TAP_START + 4, TAP_START + 8, TAP_END],
    [1, 0.85, 1.05, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const countdownVisible = frame >= TAP_END && frame < GO_END;

  const ring1 = pulseRing(frame, 0, ringPeriodFrames);
  const ring2 = pulseRing(frame, ringStaggerFrames, ringPeriodFrames);

  const endCardOpacity = interpolate(frame, [GO_END, GO_END + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: LIVE_PANEL }}>
      {sceneVisible ? (
        <AbsoluteFill style={{ opacity: introOpacity }}>
          <div
            style={{
              position: "absolute",
              top: 700,
              left: "50%",
              transform: "translateX(-50%)",
              width: BADGE_SIZE + 120,
              height: BADGE_SIZE + 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: BADGE_SIZE,
                height: BADGE_SIZE,
                borderRadius: "50%",
                border: "1px solid rgba(200, 255, 46, 0.4)",
                transform: `scale(${ring1.scale})`,
                opacity: ring1.opacity,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: BADGE_SIZE,
                height: BADGE_SIZE,
                borderRadius: "50%",
                border: "1px solid rgba(200, 255, 46, 0.4)",
                transform: `scale(${ring2.scale})`,
                opacity: ring2.opacity,
              }}
            />
            <div style={{ transform: `scale(${badgeScale})` }}>
              <RecordMark size={BADGE_SIZE} displayFontFamily={display.fontFamily} />
            </div>
            {tapVisible ? (
              <div
                style={{
                  position: "absolute",
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "#ffffff",
                  transform: `scale(${tapDotScale})`,
                  opacity: tapDotOpacity,
                }}
              />
            ) : null}
          </div>

          <p
            style={{
              position: "absolute",
              top: 560,
              left: 0,
              right: 0,
              textAlign: "center",
              margin: 0,
              fontFamily: display.fontFamily,
              fontWeight: 900,
              fontSize: 52,
              color: LIME,
              opacity: headlineOpacity,
            }}
          >
            Record. Now live.
          </p>

          <div
            style={{
              position: "absolute",
              bottom: 140,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              gap: 28,
            }}
          >
            {TAB_LABELS.map((label) => (
              <span
                key={label}
                style={{
                  fontFamily: mono.fontFamily,
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: label === "Record" ? LIME : MUTED,
                  opacity: label === "Record" ? 0.9 : 0.35,
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </AbsoluteFill>
      ) : null}

      {countdownVisible ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          {frame < COUNT_3_END ? (
            <CountdownLabel
              text="3"
              color="#f4f7ef"
              fontSize={220}
              fontFamily={mono.fontFamily}
              localFrame={frame - TAP_END}
              segmentFrames={COUNT_3_END - TAP_END}
            />
          ) : null}
          {frame >= COUNT_3_END && frame < COUNT_2_END ? (
            <CountdownLabel
              text="2"
              color="#f4f7ef"
              fontSize={220}
              fontFamily={mono.fontFamily}
              localFrame={frame - COUNT_3_END}
              segmentFrames={COUNT_2_END - COUNT_3_END}
            />
          ) : null}
          {frame >= COUNT_2_END && frame < COUNT_1_END ? (
            <CountdownLabel
              text="1"
              color="#f4f7ef"
              fontSize={220}
              fontFamily={mono.fontFamily}
              localFrame={frame - COUNT_2_END}
              segmentFrames={COUNT_1_END - COUNT_2_END}
            />
          ) : null}
          {frame >= COUNT_1_END && frame < GO_END ? (
            <CountdownLabel
              text="GO"
              color={LIME}
              fontSize={260}
              fontFamily={display.fontFamily}
              localFrame={frame - COUNT_1_END}
              segmentFrames={GO_END - COUNT_1_END}
            />
          ) : null}
        </AbsoluteFill>
      ) : null}

      {frame >= GO_END ? (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            opacity: endCardOpacity,
          }}
        >
          <RecordMark size={150} displayFontFamily={display.fontFamily} />
          <p
            style={{
              marginTop: 32,
              fontFamily: display.fontFamily,
              fontWeight: 900,
              fontSize: 40,
              letterSpacing: "0.04em",
              textAlign: "center",
              color: "#f4f7ef",
            }}
          >
            TAP TO LAP.
            <br />
            NOW LIVE.
          </p>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}

export const RECORD_REVEAL_DURATION_IN_FRAMES = 240;
```

- [ ] **Step 2: Verify types check**

Run (from `video/`): `npx tsc --noEmit`
Expected: no errors. If `Easing.back` doesn't exist on Remotion's `Easing` export, this will fail here — check Remotion's actual `Easing` type exports (`node_modules/remotion/dist/easing.d.ts` or similar) and substitute the closest available easing (e.g. `Easing.out(Easing.cubic)`) if so; don't guess blind, verify against the installed package.

- [ ] **Step 3: Commit**

```bash
git add video/src/RecordReveal.tsx
git commit -m "Add RecordReveal Instagram Story composition"
```

(This composition isn't registered in `Root.tsx` yet, so it can't be rendered or previewed until Task 3 lands — that's expected, not a gap in this task.)

---

### Task 3: Register the composition in `video/src/Root.tsx`

**Files:**
- Modify: `video/src/Root.tsx`

- [ ] **Step 1: Add the import**

Add alongside the existing composition imports at the top of `video/src/Root.tsx`:

```tsx
import { RecordReveal, RECORD_REVEAL_DURATION_IN_FRAMES } from "./RecordReveal";
```

- [ ] **Step 2: Register the composition**

Add a new `<Composition>` block inside the `<>...</>` fragment, after the existing `InstagramReveal` composition:

```tsx
      <Composition
        id="RecordReveal"
        component={RecordReveal}
        durationInFrames={RECORD_REVEAL_DURATION_IN_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
```

- [ ] **Step 3: Verify types check**

Run (from `video/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify the composition previews without crashing**

Run (from `video/`): `npx remotion still src/index.ts RecordReveal out/record-still-check.png --frame=0`
Expected: succeeds, producing `out/record-still-check.png` (a frame-0 PNG showing the faded-in intro badge). This is a smoke test, not final QA — Task 5 covers the full multi-frame QA pass.

- [ ] **Step 5: Commit**

```bash
git add video/src/Root.tsx
git commit -m "Register the RecordReveal composition"
```

---

### Task 4: Add render/still npm scripts

**Files:**
- Modify: `video/package.json`

- [ ] **Step 1: Add the scripts**

In `video/package.json`'s `"scripts"` object, add these two entries (matching the existing `render:ig`/`still:ig` naming convention):

```json
    "render:record": "remotion render src/index.ts RecordReveal out/ocht-record-reveal.mp4",
    "still:record": "remotion still src/index.ts RecordReveal out/record-still.png"
```

- [ ] **Step 2: Verify the file is still valid JSON**

Run (from `video/`): `node -e "require('./package.json')"`
Expected: no output (no error thrown).

- [ ] **Step 3: Commit**

```bash
git add video/package.json
git commit -m "Add render:record and still:record npm scripts"
```

---

### Task 5: Full render and QA pass

**Files:** none (verification only)

- [ ] **Step 1: Capture stills at each key beat**

Run each of these (from `video/`) and visually open the resulting PNG to confirm it matches the shot list beat:

```bash
npx remotion still src/index.ts RecordReveal out/record-qa-pulse.png --frame=72
npx remotion still src/index.ts RecordReveal out/record-qa-headline.png --frame=90
npx remotion still src/index.ts RecordReveal out/record-qa-tap.png --frame=112
npx remotion still src/index.ts RecordReveal out/record-qa-count1.png --frame=165
npx remotion still src/index.ts RecordReveal out/record-qa-go.png --frame=183
npx remotion still src/index.ts RecordReveal out/record-qa-endcard.png --frame=216
```

Confirm for each:
- `record-qa-pulse.png` (frame 72, ~2.4s): both rings visible mid-pulse at different scale/opacity (staggered, not in sync), badge centered and undistorted, dimmed nav sliver readable at the bottom with "Record" the brightest label.
- `record-qa-headline.png` (frame 90, ~3.0s): "Record. Now live." fully visible above the badge.
- `record-qa-tap.png` (frame 112, ~3.7s): badge visibly compressed (press flourish mid-animation), white tap dot visible over the badge center.
- `record-qa-count1.png` (frame 165, ~5.5s): full-bleed dark background (no badge/nav visible), large "1" centered.
- `record-qa-go.png` (frame 183, ~6.1s): "GO" in lime, larger than the digits were.
- `record-qa-endcard.png` (frame 216, ~7.2s): `RecordMark` + "TAP TO LAP. NOW LIVE." centered, no other copy, no URL/handle.

If any beat looks wrong (wrong position, invisible element, wrong color), fix the specific value in `RecordReveal.tsx` and re-capture that still before proceeding — don't move on with a known-wrong frame.

- [ ] **Step 2: Render the final video**

Run (from `video/`): `npm run render:record`
Expected: succeeds, producing `video/out/ocht-record-reveal.mp4`.

- [ ] **Step 3: Confirm the output file**

Run (from `video/`): `node -e "console.log(require('fs').statSync('out/ocht-record-reveal.mp4').size)"`
Expected: a non-zero byte count (a 240-frame 1080×1920 H.264 clip should be well under a few MB, similar order of magnitude to the ~1.4MB `ocht-instagram-reveal.mp4`).

Open `video/out/ocht-record-reveal.mp4` directly (e.g. via the OS file explorer or default video player) and watch it end to end to confirm the full timeline reads correctly and nothing looks broken in motion (stills only catch static frames, not motion artifacts like a ring snapping instead of easing).

- [ ] **Step 4: Clean up QA still files**

The `out/record-qa-*.png` and `out/record-still-check.png` files from Steps 1/3-of-Task-3 are throwaway QA artifacts, not deliverables — delete them:

```bash
rm video/out/record-qa-*.png video/out/record-still-check.png
```

- [ ] **Step 5: Confirm clean working tree**

Run: `git status`
Expected: clean (aside from `video/out/ocht-record-reveal.mp4` itself, which is a build output — check whether `video/out/` is already gitignored; if `ocht-instagram-reveal.mp4` isn't tracked in git, don't add this new mp4 either, for consistency).
