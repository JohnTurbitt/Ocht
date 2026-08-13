# Instagram Sneak-Peek Video — Design

## Goal

Produce a ~30 second "sneak peek" of Ocht for social (Reels/TikTok/Stories
and the Instagram feed), replacing the stale screenshot set behind the
existing `OchtDemo` composition. Shows the flow end-to-end: connecting
Strava, picking a race format (Hyrox / Tryka / custom), logging splits,
getting your archetype and race blueprint, and the premium unlock — bookended
by the Ocht shield reveal already built in `InstagramReveal.tsx`.

Two aspect ratios ship first: **Vertical 9:16** (1080x1920, Reels/TikTok/
Stories) and **Square 1:1** (1080x1080, matches the Instagram feed reveal
video already rendered). **Landscape 16:9** is deferred — the shared
components/beat data below are built so adding it later is a new composition
file, not a rebuild.

## Storyboard

Dark theme, acid-green (`--lime` `#c8ff2e`) branding, full-bleed real app
screenshots (no phone-bezel chrome — bold captions read better full-bleed
than in the old boxed-phone-in-dark-canvas look). Bold kinetic captions
(large, full-bleed on-screen type, not the old quiet pill-under-phone style).
Hard cuts, no crossfades — matches Reels/TikTok pacing. 30s @ 30fps = 900
frames total.

| # | Frames | Time | Screen | Caption |
|---|---|---|---|---|
| Intro | 0–60 | 0–2s | Shield + glow only (no ring spin-up) | — |
| 1 | 60–150 | 2–5s | Hero / landing | "Know exactly where you lose time" |
| 2 | 150–240 | 5–8s | Strava connect (onboarding) | "Connect Strava" |
| 3 | 240–330 | 8–11s | Format picker — Hyrox / Tryka 800 / Tryka 500 / Custom all visible | "Hyrox. Tryka. Or build your own." |
| 4 | 330–420 | 11–14s | Split entry form, filled | "Log your splits" |
| 5 | 420–540 | 14–18s | Results reveal + archetype card | "Meet your archetype" |
| 6 | 540–660 | 18–22s | Race blueprint / roxzone / ranked leaks | "Find your leaks" |
| 7 | 660–750 | 22–25s | Training focus / target simulator | "Your 4-week focus" |
| 8 | 750–840 | 25–28s | Premium unlock / report history | "Unlock the full report" |
| Outro | 840–900 | 28–30s | Shield (already settled) + tagline | "ocht.app" |

## Screenshot capture

The current `video/public/screenshots/*.png` are stale (page redesign since
they were taken) and belong to the separate `OchtDemo` landscape composition
— untouched by this work. New captures go in
`video/public/screenshots/sneak-peek/`:

| File | Source |
|---|---|
| `01-hero.png` | Landing page, signed out |
| `02-strava-connect.png` | Onboarding `StravaConnectScreen` component |
| `03-format-picker.png` | `SplitForm` race-format picker step (Hyrox/Tryka 800/Tryka 500/Custom all visible) |
| `04-split-form.png` | `SplitForm` filled with sample splits |
| `05-results-archetype.png` | `ResultsReveal` + `AthleteArchetypeCard` |
| `06-blueprint-leaks.png` | `RaceBlueprint` / `RoxzoneCard` + ranked leaks list |
| `07-training-simulator.png` | Training focus panel + `TargetSimulator` |
| `08-premium-unlock.png` | `PremiumTierGate` / paywall teaser, locked state |

Captured by running `npm run dev` and driving the live app via browser
automation at a mobile viewport, signed in as the seeded
`jordan.competitive@ocht.dev` account (HYROX, has report history — see
`prisma/seed-dev.ts`) for the data-bearing screens. The format-picker and
Strava-connect screens don't need seeded report data, just the right UI
state.

## Architecture

```
video/
  src/
    brandMark.tsx           # NEW — extracted shield SVG + dark palette
                             #   constants (PAPER/LIME/BADGE_INK/MUTED/
                             #   RING_LINE), shared by InstagramReveal.tsx
                             #   and the new bookend so the mark isn't
                             #   duplicated a third time
    RevealBookend.tsx        # NEW — intro/outro shield beat, mode="intro"
                              #   (fade+glow in) | mode="outro" (shield
                              #   settled + "ocht.app" tagline fades in)
    KineticCaption.tsx       # NEW — bold full-bleed caption: large Saira
                              #   Condensed type, slide+fade in/out,
                              #   acid-green on dark scrim
    SneakPeekScene.tsx       # NEW — full-bleed screenshot + Ken Burns
                              #   zoom/pan (object-fit: cover), aspect-ratio
                              #   agnostic (parent Composition sets w/h)
    sneakPeekBeats.ts        # NEW — shared beat data (screenshot path,
                              #   caption text, frame range) consumed by
                              #   both compositions so they can't drift
    InstagramSneakPeekVertical.tsx  # NEW — 1080x1920 composition
    InstagramSneakPeekSquare.tsx    # NEW — 1080x1080 composition
    InstagramReveal.tsx      # EDITED — re-point shield markup/constants at
                              #   brandMark.tsx instead of local duplicates
    Root.tsx                 # EDITED — register the two new Compositions
  public/
    screenshots/
      sneak-peek/             # NEW — the 8 fresh captures above
```

- `sneakPeekBeats.ts` is the single source of truth for beat order, timing,
  and captions — both compositions map over the same array, so the two
  aspect ratios can never fall out of sync on content, only on layout.
- `SneakPeekScene.tsx` takes a screenshot path + caption + its own
  `durationInFrames` (read from the beat data) and is otherwise identical
  between vertical and square; the composition wrapper controls
  width/height, `SneakPeekScene` just fills whatever `AbsoluteFill` it's
  given.
- `KineticCaption.tsx` is deliberately not the old `Scene.tsx` caption
  style — full-bleed, large type, brief hold, matching the "bold kinetic
  captions" direction.
- No crossfades between beats (hard cuts) — consistent with the
  Reels/TikTok pacing decision; `@remotion/transitions` isn't used here
  (unlike `OchtDemo.tsx`'s fades).

### Rendering

New npm scripts in `video/package.json`:

```bash
npm run render:ig-vertical  # remotion render src/index.ts InstagramSneakPeekVertical out/ocht-sneak-peek-vertical.mp4
npm run render:ig-square    # remotion render src/index.ts InstagramSneakPeekSquare out/ocht-sneak-peek-square.mp4
```

## Verification

- Render both compositions and visually review (open the MP4s) for: correct
  beat order/timing, captions readable and not clipped at either aspect
  ratio, screenshots match the current live app, Ken Burns pan doesn't crop
  out important UI (e.g. the archetype badge, the format picker options),
  intro/outro shield mark matches the already-approved Instagram reveal
  video's look.
- Spot-check with still frames (`remotion still`) at each beat boundary
  before committing to a full render, same QA approach used for
  `InstagramReveal.tsx`.
- No automated tests — content/asset-generation task, separate
  `video/package.json`, doesn't touch the main app's test suite.

## Risks / open items

- The Strava-connect and format-picker screens may need the app driven into
  a specific onboarding/UI state rather than just "log in and screenshot" —
  budget a few retries via browser automation to land the right state.
- Full-bleed `object-fit: cover` at 1:1 will crop more of a portrait
  screenshot than 9:16 does; if an important UI element (e.g. the archetype
  badge) gets cropped out of the square version, that beat's Ken Burns
  focal point needs a manual override per composition rather than sharing
  one crop value.
- Landscape 16:9 is out of scope for this pass; when added later it reuses
  `sneakPeekBeats.ts` and `SneakPeekScene.tsx` but may want the old
  phone-frame treatment back (landscape has room for chrome that vertical/
  square don't) — a decision for that follow-up, not this one.
