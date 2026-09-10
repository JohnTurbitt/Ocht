# Navigation Redesign — Record as the Brand Mark

**Date:** 2026-08-24
**Status:** Approved for planning
**Depends on:** `docs/superpowers/specs/2026-08-24-live-logger-dedicated-page-design.md` (the record button navigates to `/app/live`, which that spec introduces).

## Why this change

The mobile bottom nav and desktop tab row (`app/app/page.tsx`'s `.tab-bar`) currently treat "Log live" as just another destination — a 5th pill/tab equal in weight to New report, Progress, Compare, Records. Once the live logger becomes a dedicated, Strava-style recording page, its entry point deserves the same weight Strava gives its own record button: raised, visually distinct, the one thing in the nav that's an action rather than a destination.

Rather than a generic "+" icon, Ocht already has a signature visual — the concentric lime rings pulsing behind the shield (`components/AppLaunchSplash.tsx`, also echoed in `ReportGenerationOverlay`'s 8-segment ring). Reusing that exact motif for the record button was reviewed and approved (mockup: mobile bottom nav + desktop tab row) — this spec formalizes it.

## Approved design

**Mobile bottom nav** (currently `.tab-bar` under the `max-width: 640px` breakpoint in `styles/_layout.scss`): five slots — New, Progress, **Record** (center, raised), Compare, Records. Record is a circular lime button (gradient fill, `radial-gradient(circle at 35% 30%, #d8ff6a, #b6ef00 60%, #94c700 100%)`) sitting ~30px above the bar's top edge, with the `OchtShield` glyph centered inside it in dark ink, and two concentric rings pulsing outward continuously behind it (`2.2s ease-out infinite`, staggered ~0.7s apart, opacity fading to 0 as they scale to 1.55×) — same animation language as `AppLaunchSplash`'s rings, not a new one invented for this. Respects `prefers-reduced-motion` (rings become static, no animation) — same convention already used for the station-octagon pulse in `styles/_report.scss`.

**Desktop tab row** (currently the same `.tab-bar` markup, unstyled-as-bottom-nav above 640px): the four filled pill tabs (New report, Progress, Compare, Records) restyle to a quieter underline treatment — text + a 2px lime underline on the active tab, no filled background — so the row reads as one active state among four peers, not five equal buttons. The freed visual weight goes to a standout right-aligned "Record live" pill: the same shield-in-a-badge treatment (smaller, static — no pulsing rings needed at this size/context) on a lime pill background, anchoring the row as the one control that isn't a tab.

**Desktop header row** (`.site-header`, above the tab row) is unchanged — brand, nav links (Events, HYROX, TRYKA, Pacing calculator), auth/avatar. It already does its job; nothing here needed a redesign.

Both buttons navigate to `/app/live` (a plain `<Link>`, per the dedicated-page spec — no local state to set).

## Decision: Events moves out of the bottom bar

Today, `tab-bar__tab--events` (opens `EventsSheet`) only appears in the **mobile** bottom nav — on desktop it's `display: none` there, because Events already lives in `.site-header__nav` via `UpcomingEventsMenu`, visible regardless of viewport width.

With Record taking the bottom nav's center slot, there's no clean spot left for a 6th item without cramming six controls into a bar designed for five. **Decision: drop `tab-bar__tab--events` from the mobile bottom nav entirely.** Events remains reachable exactly as it already is on desktop — via the header's `UpcomingEventsMenu` — so this isn't removing a feature, it's removing a second, redundant entry point to the same sheet. This was flagged explicitly during mockup review rather than assumed; no objection was raised, so it's confirmed as part of this spec.

## Components

**New:**
- `components/RecordBadge.tsx` — the shield-in-rings visual, as its own small presentational component (not a re-use of `AppLaunchSplash`, which carries launch-sequence timing/exit-animation logic this doesn't need). Props: `{ size?: "compact" | "full"; pulsing?: boolean }` — `"full"` + `pulsing` for the mobile raised button, `"compact"` + static for the desktop pill. Pure SVG + CSS animation, no component state.

**Modified:**
- `app/app/page.tsx` — the `.tab-bar` JSX: remove the Events button, insert the Record link (using `RecordBadge`) between Progress and Compare, wrap it as a `<Link href="/app/live">` rather than a `<button onClick>` (it's real navigation now, no tab-switch state).
- `styles/_layout.scss` — `.tab-bar` and related classes get a real rework: the mobile media-query block gains the raised-button grid column and positioning (see the mockup's `.mnav__record`/`.mnav__ring` structure — note the mockup's own first draft had a real bug worth avoiding in implementation: the record button's positioning container must have an explicit height, not rely on being centered by the parent's `align-items: center` on an otherwise-collapsed zero-height box, or the raise ends up calculated from the row's middle instead of its top and the button reads as clipped/sunk into the bar instead of clearly rising above it). The desktop (non-mobile) block changes from filled pills to underline-style tabs plus the standout record pill.

## Out of scope

No changes to `.site-header` (brand/nav links/auth), no changes to what each tab *shows* (New report / Progress / Compare / Records content is untouched), no changes to `EventsSheet` itself. This is purely the nav chrome and the live-logger entry point's visual weight.

## Testing

Presentational-only change (nav chrome, no new logic beyond a `<Link>` swap) — verified by eye in both mobile and desktop widths, both themes (the nav sits outside the live-tracker page's dark-only scope — it's part of the regular themed app shell, so it must still respect light/dark same as today), and with `prefers-reduced-motion` on, matching this codebase's established convention of not unit-testing presentational components.
