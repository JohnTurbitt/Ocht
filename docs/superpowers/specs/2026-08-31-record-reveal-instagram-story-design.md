# Record Reveal — Instagram Story Video Design

## Goal

An ~8s vertical (1080×1920) Instagram Story video announcing that the new Record button / live session tracker is live in the app. Built as a Remotion composition, following the same pipeline and reuse-over-redesign principle as the earlier Ocht logo-reveal video (see the `ocht-instagram-logo-video` memory): pull real brand/component values into the render rather than re-drawing approximations by eye.

**Scope:** announcement only. This video does not attempt to explain or demo the full live-tracking feature (segment taps, splits, report generation) — it exists purely to tell existing users/followers "the Record button is live," ending on a brand card. A follow-up video showing the actual tracking flow is out of scope for this spec.

## Format

- 1080×1920 (vertical Story), 30fps, 240 frames (8.0s).
- New Remotion composition `RecordReveal`, registered in `video/src/Root.tsx` alongside the existing `OchtDemo` and `InstagramReveal` compositions.
- Component file: `video/src/RecordReveal.tsx`.

## Shot list / timeline

| Frames | Time | Beat |
|---|---|---|
| 0–36 | 0.0–1.2s | Fade in on `#0e1914` background (the real `$live-panel` value from `styles/_live-session.scss`). A dimmed, non-interactive text sliver of the five bottom-nav tab labels (New / Progress / **Record** / Compare / Records) sits at the frame's bottom edge. The `RecordBadge` shield-in-rings mark sits raised above it, rings already mid-pulse. |
| 36–108 | 1.2–3.6s | ~2 full pulse cycles play out (ring period 2.2s, two rings staggered 0.7s — see Motion section). A headline fades in above the badge: **"Record. Now live."** |
| 108–120 | 3.6–4.0s | A fingertip graphic taps the badge; badge does a quick scale-down/up press flourish (see "Deliberate non-parity" below). Headline fades out. |
| 120–138 | 4.0–4.6s | Hard cut: background and nav sliver disappear, full-bleed `#0e1914`. Big centered mono digit **"3"** scale-pops in. |
| 138–156 | 4.6–5.2s | **"2"** |
| 156–174 | 5.2–5.8s | **"1"** |
| 174–192 | 5.8–6.4s | **"GO"** flashes in lime (`#c8ff2e`), scale-pops larger than the digits. |
| 192–240 | 6.4–8.0s | Cut to static brand end-card: `OchtShield` mark + wordmark (same treatment as `InstagramReveal.tsx`'s opening frames) with headline **"TAP TO LAP. NOW LIVE."** No URL/handle/CTA baked in — Instagram's own link/mention stickers are layered on after posting, not part of the render. |

## Visual treatment & asset reuse

Reuse real values wherever the app already defines them, rather than re-approximating by eye:

- **Background:** literal `#0e1914` — the actual dark-only live-page background, not a new gradient.
- **Record badge:** re-rendered from the same SVG path/gradient data as `components/RecordBadge.tsx` (shield path `M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z`, radial lime gradient fill), so it's pixel-identical to the real in-app badge — not a redrawn approximation.
- **Pulse rings:** ported from the `tab-bar-record-pulse` keyframe (`styles/_layout.scss`): scale 1 → 1.55, opacity 0.7 → 0, 2.2s ease-out, infinite, two rings staggered 0.7s apart. Re-expressed as Remotion frame-based interpolation (`interpolate()` against `useCurrentFrame()`) rather than CSS `@keyframes`, since Remotion renders frame-by-frame rather than running live CSS animation.
- **Nav sliver:** plain text labels only (no icons, no interactivity) reading the five real tab names in their real order (New, Progress, Record, Compare, Records) at reduced opacity — just enough to signal "this is inside the app," not a full UI recreation.
- **Countdown digits + "GO":** DM Mono, self-hosted via the same `next/font/google` setup pattern already used elsewhere (weight 700–800 for punch), matching the tracker's own timer typography (`.live-session-tracker__timer` in `_live-session.scss`) and the logo video's established mono usage.
- **End card:** reuses the exact `OchtShield` mark + wordmark composition from `video/src/InstagramReveal.tsx`'s opening beat, so the two videos read as one campaign rather than two different visual systems.

### Deliberate non-parity: the tap-press flourish

The real `RecordBadge`/`tab-bar__record` has no `:active`/press animation in the live app today — tapping it just navigates. For this video, a brief scale-down/up "press" plays when the fingertip graphic touches the badge (frames 108–120). This is a deliberate, called-out exception to the "reuse real values" principle: it exists purely for legibility (a static tap needs *some* visual feedback to read as "pressed" on video), not because it reflects real app behavior. If the real button ever gains a press state, this should be revisited to match it.

## Copy

- Mid-pulse headline: **"Record. Now live."**
- End-card headline: **"TAP TO LAP. NOW LIVE."**
- No other copy. No fabricated URL, handle, or CTA text is baked into the render.

## Technical output

- Render script: `npm run render:record` (from `video/`), mirroring the existing `render:ig` convention, outputting `video/out/ocht-record-reveal.mp4` (H.264 MP4, 1080×1920, 30fps).
- Still-frame QA script: `npm run still:record`, mirroring `still:ig`, for checking key beats: mid-pulse (headline visible), countdown "1", "GO" flash, end card.
- No new dependencies expected — this reuses the same Remotion setup already installed under `video/`.

## Accessibility note

The real in-app Record button respects `prefers-reduced-motion` (rings render static). That's a live-app concern only; this video is a fixed, pre-rendered file with no reduced-motion branch — not applicable to a rendered MP4.

## Out of scope

- Demoing the actual live-tracking flow (segment taps, splits drawer, report generation) — announcement only, per the approved design.
- A square/feed-post variant — this spec covers the Story (vertical) format only. A feed variant, if wanted later, would be a separate follow-up spec reusing these same assets at a different aspect ratio.
- Any Instagram-native overlays (link sticker, mentions, music) — added after export, not part of the render.
