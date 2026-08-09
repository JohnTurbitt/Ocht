# Ocht Demo Video — Design

## Goal

Produce a ~90 second product walkthrough video showing off Ocht's core
features, suitable for a landing page, social share, or investor/beta
briefing. Built from real screenshots of the running app, assembled with
motion and captions.

## Storyboard

Landscape 1920x1080 @ 30fps, dark theme with Ocht's acid-green (`--lime`,
`#c8ff2e`) branding, mobile screenshots presented in a phone-frame mockup
(the app is mobile-first). Crossfade between scenes. ~90s total.

| # | Scene | Caption | Length |
|---|-------|---------|--------|
| 1 | Logo reveal (Ocht shield + "ocht.") | — | 4s |
| 2 | Hero / landing | "Race split analysis for hybrid athletes" | 7s |
| 3 | Split form — race format picker (HYROX / TRYKA 800 / TRYKA 500 / Custom) | "Pick your race format" | 8s |
| 4 | Split form filled with sample splits | "Enter your run & station splits" | 8s |
| 5 | Report generation overlay | "Instant analysis" | 4s |
| 6 | Results reveal (finish time count-up, archetype, top leak) | "Get your results instantly" | 8s |
| 7 | Report panel — race flow map, archetype & roxzone cards | "See your race flow, archetype & roxzone tax" | 10s |
| 8 | Report panel — ranked time leaks | "Find your biggest time leaks" | 8s |
| 9 | Training focus / 4-week plan | "Get a 4-week training focus" | 8s |
| 10 | Target Simulator | "Simulate a faster finish" | 8s |
| 11 | Progress dashboard / report history | "Track progress across races" | 8s |
| 12 | Premium badge / paywall teaser | "Unlock the full report with Ocht Premium" | 6s |
| 13 | Closing logo + tagline | "ocht. — train smarter, race faster" | 5s |

## Architecture

A new standalone Remotion project at `video/` (own `package.json`,
independent of the main app's dependencies and not part of `npm run build`).

```
video/
  package.json          # remotion, @remotion/cli, @remotion/google-fonts, react/react-dom
  remotion.config.ts
  public/
    screenshots/         # captured PNGs, one per storyboard scene needing one
  src/
    Root.tsx             # registers <Composition id="OchtDemo" .../>
    OchtDemo.tsx          # top-level sequence of scenes with crossfade transitions
    Scene.tsx             # reusable: phone-frame + screenshot + Ken Burns + caption
    LogoScene.tsx         # scenes 1 & 13 (no screenshot, branded logo animation)
    theme.ts              # shared colors/fonts matching Ocht tokens
  out/                    # rendered output (gitignored)
```

### Screenshot capture

- Run `npm run dev` (existing script, port 3002).
- Drive the app via the chrome-devtools browser tool at a mobile viewport
  (~390x844) to reach each scene's state (load sample race, generate report,
  open target simulator, switch to Progress tab, etc.) and capture a PNG per
  scene into `video/public/screenshots/`.
- Scenes 5 and 6 (generation overlay, results reveal) require timing the
  screenshot during the transient overlay states.
- Scene 12 (premium teaser) captures the paywall/lock UI in its locked state
  — no Stripe checkout flow needed.
- Scenes 1 and 13 don't need screenshots; they're built from the `OchtShield`
  mark + wordmark recreated directly in Remotion (simple SVG/text, matches
  existing branding).

### Composition

- `Scene.tsx`: renders a phone-frame mockup containing the screenshot, applies
  a subtle Ken Burns zoom/pan via `interpolate(frame, ...)`, on a dark
  gradient background with a lime glow accent and the ghost "8" watermark
  motif (reused from the app's visual language). Caption text (Saira
  Condensed, loaded via `@remotion/google-fonts`) animates in/out
  (slide + fade) at the bottom of the frame.
- `OchtDemo.tsx`: sequences all 13 scenes back-to-back using
  `@remotion/transitions` (fade) for crossfades, total duration computed from
  the storyboard lengths (~90s = 2700 frames at 30fps).
- `theme.ts`: shared constants — `--lime` (#c8ff2e), dark surface/panel
  colors, matching the main app's `_base.scss` tokens so the video reads as
  "the same product."

### Rendering

`npx remotion render src/Root.tsx OchtDemo out/ocht-demo.mp4` produces the
final MP4 at `video/out/ocht-demo.mp4`. `video/out/` and
`video/node_modules/` are gitignored.

## Verification

- Render the video and visually review it (open the MP4) for: correct scene
  order/timing, captions readable, screenshots match real app UI, no layout
  glitches in the phone-frame mockup, smooth crossfades.
- No automated tests — this is a content/asset-generation task, not app
  logic. The main app's existing test suite is untouched (separate
  `video/package.json`).

## Risks / open items

- Capturing the transient overlay states (scenes 5, 6) may need a few
  retries to time correctly via the chrome-devtools tool.
- Font loading (`@remotion/google-fonts` for Saira Condensed) requires
  network access during `remotion render`; if unavailable, fall back to a
  bundled system font for captions.
