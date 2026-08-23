# Live Race/Training Split Logger — Design Spec

**Date:** 2026-08-17
**Status:** Approved for planning

## Goal

Ocht's report today requires splits to be entered after the fact — from memory, or a results page. This adds a live, tap-to-lap logger a user runs on their phone **during** a HYROX/TRYKA race or a training session, so splits are captured accurately in real time instead of reconstructed afterward. It's built for both race day and training use, with race day as the hard reliability constraint (must survive patchy venue connectivity, one-handed use, accidental taps).

The logged session feeds directly into the **existing** report pipeline — `buildAnalysis`, `ReportGenerationOverlay`, `ResultsReveal`, saved history — unchanged. This is not a new report type; it's a new way of producing the same `runs[]`/`stationSplits` input `SplitForm` already produces today.

## Out of scope

- Voice/audio-driven logging — the tap-to-lap interaction is the v1 approach; voice is a much larger, less-proven build (speech permissions, background reliability) and not needed to validate the core idea.
- Custom race formats — the live logger's format picker offers the same non-custom formats already used by `PacingCalculator` (`hyrox`, `tryka800`, `tryka500`), for the same reason: custom formats have no fixed, known-in-advance station sequence, which the tap-to-lap flow depends on.
- A separate review/edit screen before the session becomes a report — mis-taps are handled by a one-tap undo during the session instead (see below). If this proves insufficient in practice, a review step is a natural v2 addition, not part of this build.
- Full offline/service-worker PWA support — the app has none today. The logger instead leans on the same local-first `localStorage` pattern already used by `lib/reportStorage.ts`, which is sufficient for surviving a dropped connection or a backgrounded tab, without requiring new offline infrastructure.

## Where this lives in the app

A new entry point inside the existing signed-in app shell (`app/app/page.tsx`), alongside the current preset actions ("Load sample race", "Reset defaults", "Clear form") — a "Log live" button that swaps `SplitForm` out for the new live-session flow, using the same `raceFormat`/`generatingReport`/`showResultsReveal`/`analysis` state already present in that file. Not a new route — the live logger produces the same `runs[]`/`stationSplits` shape `SplitForm` does and hands off into the exact same `handleSubmit`-adjacent code path, so it belongs in the same component tree, not a separate page.

Works whether signed in or not, matching existing behavior — `lib/reportStorage.ts` already supports both account-backed and local-only (anonymous) report storage.

## Flow

1. **Setup screen** (new) — format picker (reusing the `.format-picker`/`.format-card` pattern already used by `SplitForm` and `PacingCalculator`), level select, optional target time (reusing `maskTimeInput`/`normalizeTimeInput`). "Start session" begins the live screen and requests a Screen Wake Lock.
2. **Live-tap screen** (new) — see "Live screen design" below.
3. **Finish beat** (new, brief — a few hundred ms) — once the final segment is tapped, the station-progress octagon (built during the session) plays a short "all 8 lit" glow animation before handing off.
3.5. **Official finish time prompt** (new, optional) — immediately after the finish beat, a single optional field: "Official finish time (from the results board or your chip)". This is the same `officialFinishTime` input `buildAnalysis` already accepts for manual entry — capturing it here is what lets the live session produce a real roxzone-tax number (see "Roxzone" below), not a new analysis feature. Left blank, the report generates exactly as it does today without one.
4. **Report generation** (existing, reused unchanged) — `ReportGenerationOverlay`, driven by calling `buildAnalysis` with the logged `runs[]`/`stationSplits`/`level`/`raceFormat`/optional `targetTime`/optional `officialFinishTime`, exactly as `SplitForm`'s submit path does today.
5. **Results reveal** (existing, reused unchanged) — `ResultsReveal`, same as the manual flow.
6. **Report / history** (existing, reused unchanged) — the normal `ReportPanel`, saved via the existing `SavedReport`/`lib/reportStorage.ts` mechanism.

Steps 4-6 require **zero new code** — the live logger's only job is to produce a valid `runs[]`/`stationSplits` pair and call into the same pipeline `SplitForm` already calls.

## Roxzone

Roxzone tax is never entered directly anywhere in this app — `buildAnalysis` always *derives* it as `officialFinishTime − (sum of all run/station splits)`. That's unchanged by this feature. Without capturing an official finish time, the live logger would produce splits with no roxzone number at all, identical to manual entry today.

**Decision (confirmed before implementation began):** capture `officialFinishTime` as a single optional field at step 3.5 above, feeding the same unmodified `buildAnalysis` parameter manual entry already uses. This gives a real roxzone-tax number — and a *more accurate* one than manual entry, since the run/station splits feeding the calculation were captured live rather than reconstructed afterward — but still only as one lump total for the whole race, not broken down per-transition.

**Explicitly deferred (a separate future feature, not part of this build):** true per-transition roxzone tracking, where each of the 15 gaps between the 16 run/station segments gets its own captured duration. That would require doubling the number of taps needed (up to 31), which conflicts with this feature's core race-day-reliability goal ("one big button, minimize taps, minimize room for error"), and would need real changes to `lib/analysis.ts` (which has no concept of pre-computed per-transition roxzone today) plus new report UI to surface it. Worth its own spec later if lump-sum roxzone proves insufficient in practice — not folded into this build.

## Live screen design

Layout (approved via visual mockup): a compact station-progress octagon top-left, current segment label, a large tap-to-lap button showing a live-ticking elapsed time for the current segment, and a scrolling list of completed splits below.

**Station-progress octagon:**
- 8 sides = 8 stations (not the 16 total run+station segments — run legs aren't tracked by this shape, only the fixed 8 stations, which is the "ocht = 8" visual hook).
- Three states per side: grey/muted (not yet reached), pulsing lime with a soft glow (the station currently underway), solid lime (completed).
- The Ocht shield mark (`components/OchtShield.tsx`'s path, at correct 64:78 proportions) sits centered, echoing the same visual language `ReportGenerationOverlay`'s existing 8-segment ring + centered shield already uses — this is a discovered continuity, not a new pattern being introduced to the app.
- On the final tap, the octagon briefly shows all 8 sides solid with a stronger glow before the screen transitions to `ReportGenerationOverlay`.

**Tap button:**
- One large tap target. A live mm:ss timer for the current segment is the dominant element on the button (large numerals), with a smaller "TAP TO LAP" label beneath it.
- Tapping records the current timestamp, computes that segment's duration, appends it to the session's `runs[]`/`stationSplits`, advances to the next segment in the fixed sequence, and resets the on-button timer to `0:00`.
- A one-tap **undo** below the button removes the most recently logged segment and rewinds the current-segment state by one (so a mis-tap doesn't require restarting the whole session).

**Split list:** a simple, append-only scrolling list of completed segments and their times, below the tap button — useful for reviewing pace mid-session (particularly for training use) without leaving the live screen.

## Data model & persistence

A live session's in-progress state must survive a dropped connection, an accidental tab close, or a phone lock, without losing logged taps.

**Local-first autosave**, matching `lib/reportStorage.ts`'s existing pattern: every tap (and every undo) immediately writes the session's current state to `localStorage` under a dedicated key (e.g. `ocht.liveSession.draft`), not just at the end. On load, if a draft session exists (interrupted, not yet finished), the app offers to resume it rather than silently discarding it.

Draft shape (new, `lib/liveSession.ts`):

```ts
export type LiveSessionDraft = {
  raceFormat: RaceFormat; // hyrox | tryka800 | tryka500 (no "custom")
  level: Level;
  targetTime: string; // may be empty — optional, same as SplitForm today
  startedAt: string; // ISO timestamp, when "Start session" was tapped
  segments: LiveSessionSegment[]; // completed taps only, in order
};

export type LiveSessionSegment = {
  type: "run" | "station";
  key: string; // "run-1".."run-8", or a StationKey for stations
  seconds: number; // this segment's duration, derived from consecutive tap timestamps
};
```

On finish, `LiveSessionDraft.segments` is converted into the exact `runs: string[]` / `stationSplits: Record<StationKey, string>` shape `buildAnalysis` already expects (existing type, no changes) — a small, pure mapping function, not new analysis logic.

## Screen Wake Lock

The live screen requests `navigator.wakeLock.request('screen')` on mount (session start) and releases it on unmount (finish, or leaving the screen). Feature-detected (`'wakeLock' in navigator`) with a silent no-op fallback — not universally supported (works on modern Chrome/Android and Safari iOS 16.4+), but the app must not error or block on browsers without it.

## Components

**New:**
- `components/LiveSessionSetup.tsx` — the setup screen (format/level/target, reusing existing `.format-picker`/`.field` patterns).
- `components/LiveSessionTracker.tsx` — the live-tap screen (octagon + timer button + split list + undo), plus the post-finish optional official-finish-time prompt (step 3.5).
- `components/StationProgressOctagon.tsx` — the 8-side octagon progress shape described above. **Distinct from** the `StationOctagon` component already spec'd in `docs/superpowers/specs/2026-08-14-report-training-visuals-design.md` — that one is a post-race radar comparing performance against benchmark; this one is a live completion tracker with different data (`doneCount`/`inProgress`, not gap-vs-benchmark). Different purpose, different props, kept as separate components rather than overloading one.
- `lib/liveSession.ts` — pure logic: `LiveSessionDraft`/`LiveSessionSegment` types, the fixed segment sequence for a given format (derived from `raceFormatOptions`, same source `PacingCalculator` already reads), tap-to-segment mapping, draft-to-`runs[]`/`stationSplits` conversion, localStorage read/write for the draft.
- `lib/wakeLock.ts` — thin, feature-detected wrapper around the Screen Wake Lock API.

**Modified:**
- `app/app/page.tsx` — a new "Log live" entry point beside the existing preset actions; new state to swap between `SplitForm` and the live-session flow; on live-session finish, calls the same `buildAnalysis`/`generatingReport`/`showResultsReveal` path already used by the manual submit handler.

## Testing

Following existing project convention (pure logic tested, presentational/motion components verified by eye — no jsdom/testing-library in this project):

- `lib/liveSession.test.ts` — segment-sequence generation per format, tap→segment duration math, undo correctly removes the last segment and rewinds state, draft→`runs[]`/`stationSplits` conversion produces the exact shape `buildAnalysis` expects, draft persistence round-trips through `localStorage` (using the same window-stubbing approach `lib/preferences.test.ts` already uses for `localStorage`/`matchMedia`).
- `lib/wakeLock.ts` — a small test confirming it no-ops safely when `navigator.wakeLock` is undefined (feature-detection path), not testing real browser Wake Lock behavior (not feasible without a real browser).
- `LiveSessionSetup.tsx`, `LiveSessionTracker.tsx`, `StationProgressOctagon.tsx` — presentational, no new unit tests, verified visually in both themes during implementation (same convention already applied to `PacingCalculator.tsx` and the other report-visual components this session).

## File summary

**New:**
- `components/LiveSessionSetup.tsx`
- `components/LiveSessionTracker.tsx`
- `components/StationProgressOctagon.tsx`
- `lib/liveSession.ts`, `lib/liveSession.test.ts`
- `lib/wakeLock.ts`, `lib/wakeLock.test.ts`

**Modified:**
- `app/app/page.tsx`
