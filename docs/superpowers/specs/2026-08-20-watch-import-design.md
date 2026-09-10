# Watch Import (via Strava Laps) — Design Spec

**Date:** 2026-08-20
**Status:** Approved for planning

## Goal

A third way to fill in race/training splits, alongside manual entry (`SplitForm`) and the live tap-to-lap logger (`docs/superpowers/specs/2026-08-17-live-race-logger-design.md`): import an athlete's own watch data via their existing Strava connection, for athletes who prefer wearing a watch and manually lapping it at each transition rather than holding their phone during the race.

This is not a Garmin-specific integration. Ocht already has a working Strava OAuth connection (`lib/stravaTokens.ts`, `app/api/strava/*`), and most watch brands (Garmin, Coros, Polar, Apple Watch) already auto-sync completed activities to Strava. Building against Strava's existing activity/laps API covers all of those athletes without a new OAuth provider or Garmin's separate developer-approval process.

## Out of scope

- A direct Garmin Connect API integration — Strava covers the same athletes with far less build (no new OAuth flow, no developer-program approval gate). Revisit only if a real gap in Strava's lap data surfaces in practice.
- Real-time/live watch data — Strava's API only exposes an activity after the athlete has finished and synced their watch. This feature is a post-race import, not a live-tracking alternative to the tap-to-lap logger.
- Auto-detecting station boundaries from raw GPS/accelerometer data — not something Strava's API exposes, and not attempted here. The feature depends entirely on the athlete manually lapping their watch at each transition; see the guide screen below.

## Flow

1. **Guide screen** (new, static) — before importing, a simple instructional checklist: lap your watch after each run and after each station (16 laps total for a standard HYROX/TRYKA format), and make sure Strava is connected. No interactivity — just clear guidance, since the whole feature only works if the athlete actually did this during their session.
2. **Activity picker** (new) — lists the athlete's recent Strava activities (via a new endpoint wrapping the existing `getActivities` Strava client call, not currently exposed to the client) so they can pick which one is the race/session to import.
3. **Lap editor** (new) — the picked activity's laps are fetched and displayed as an editable list. The athlete can merge, split, delete, or reorder laps until they match the expected 16-segment sequence (8 runs + 8 stations) for the selected format. This is deliberately editable rather than a hard reject-on-mismatch, since a single mis-tapped lap is a common, recoverable mistake, not a reason to force the athlete back to fully manual entry.
4. **Handoff** (existing, reused unchanged) — once the lap editor's segments match the expected sequence, the resulting `runs[]`/`stationSplits` feed into the same `buildAnalysis` → `ReportGenerationOverlay` → `ResultsReveal` pipeline already used by manual entry and the live logger. No new report-generation logic.
5. **Report / history** (existing, reused unchanged) — saved via `lib/reportStorage.ts`, with one new field: `source: "watch-import"` (see Data model below), which drives the disclaimer.

## Where this lives in the app

A new "Import from watch" entry point beside "Log live" in the existing preset actions row (`app/app/page.tsx`) — the same location as the live-logger's entry point, since both are alternative ways to produce the same `runs[]`/`stationSplits` input `SplitForm` produces manually. Not a new route, for the same reason established in the live-logger spec: this belongs in the same component tree as the report-generation handoff it feeds into.

## Disclaimer

Reports whose `source` is `"watch-import"` show a small, persistent note on `ReportPanel` (and the saved report view) — something like: *"These splits were self-tracked from a watch and may differ from official results due to manual lap timing."* Shown only for watch-imported reports — manual entry and the live tap-to-lap logger don't show it, since the disclaimer is specifically about the accuracy risk of relying on the athlete's own lap-button timing against a watch's clock, not a general caveat about the app.

## Data model

**`lib/reportStorage.ts`** — `SavedReport` gets one new optional field (backward compatible; existing saved reports have no `source` and are treated as manual):

```ts
export type SavedReport = {
  // ...existing fields unchanged...
  source?: "manual" | "live" | "watch-import";
};
```

**`lib/stravaTypes.ts`** — new type for a single Strava lap (only the fields this feature needs, not the full Strava lap object):

```ts
export type StravaLap = {
  id: number;
  lapIndex: number;
  elapsedTimeSeconds: number;
  startDate: string;
};
```

**`lib/stravaLaps.ts`** (new, pure logic, no React/DOM):
- `validateLapCount(laps: StravaLap[], expectedCount: number): boolean` — does the current lap list match the format's expected segment count.
- `mergeLaps(laps: StravaLap[], indexA: number, indexB: number): StravaLap[]` — combine two adjacent laps into one (their times sum), for a missed lap-tap.
- `splitLap(laps: StravaLap[], index: number, splitAtSeconds: number): StravaLap[]` — divide one lap into two, for a double-length lap covering two segments.
- `deleteLap(laps: StravaLap[], index: number): StravaLap[]` — remove an accidental extra lap (e.g. a stray double-tap).
- `mapLapsToSegments(laps: StravaLap[], raceFormat: RaceFormat): { runs: string[]; stationSplits: Record<StationKey, string> }` — once the lap count matches, maps them in order (run, station, run, station...) to the exact shape `buildAnalysis` expects, using `formatTime`/`raceFormatOptions` already in the codebase.

## Components

**New:**
- `components/WatchImportGuide.tsx` — the static pre-import checklist screen.
- `components/WatchImportActivityPicker.tsx` — lists recent Strava activities (via the new API route below), lets the athlete pick one.
- `components/WatchImportLapEditor.tsx` — the editable lap list (merge/split/delete/reorder), showing live validation against the expected segment count for the selected format, disabling "Continue" until it matches.

**Modified:**
- `lib/stravaClient.ts` — new `getActivityLaps(userId, activityId)`, calling Strava's `/activities/{id}/laps` endpoint (same `stravaFetch` helper already used by `getAthlete`/`getActivities`, no new auth pattern).
- `lib/stravaTypes.ts` — add `StravaLap`.
- `lib/reportStorage.ts` — add the optional `source` field to `SavedReport`.
- `components/ReportPanel.tsx` — conditional disclaimer rendering when the current report's `source === "watch-import"`.
- `app/app/page.tsx` — new "Import from watch" entry point beside "Log live"; new state to move through Guide → Picker → Lap Editor → the existing `buildAnalysis`/`generatingReport`/`showResultsReveal` handoff, tagging the resulting saved report with `source: "watch-import"`.

**New API routes** (following the existing `app/api/strava/*` auth pattern — `getCurrentUser`/`requireCurrentUser`, same as `profile`/`status`/`sync`):
- `app/api/strava/activities/route.ts` — `GET`, returns the athlete's recent Strava activities. Wraps the existing `getActivities` Strava client function, which isn't currently exposed to the client (only used server-side by `stravaSyncService`).
- `app/api/strava/activities/[id]/laps/route.ts` — `GET`, returns the laps for one activity, via the new `getActivityLaps` client function.

## Testing

Following existing project convention (pure logic tested, presentational components verified by eye):

- `lib/stravaLaps.test.ts` — `validateLapCount` for matching/mismatched counts across formats; `mergeLaps`/`splitLap`/`deleteLap` produce correct resulting lists (including edge cases: merging/splitting/deleting at the first or last lap); `mapLapsToSegments` produces the exact `runs[]`/`stationSplits` shape `buildAnalysis` expects, in the correct run/station order.
- `app/api/strava/activities/route.test.ts`, `app/api/strava/activities/[id]/laps/route.test.ts` — new route tests following the existing pattern already used by `app/api/strava/profile/route.test.ts` (auth-required, returns expected shape, error handling).
- `WatchImportGuide.tsx`, `WatchImportActivityPicker.tsx`, `WatchImportLapEditor.tsx` — presentational, no new unit tests (no jsdom/testing-library in this project), verified visually in both themes during implementation. The lap-editing *logic* itself is fully covered via `lib/stravaLaps.test.ts` — the component only wires that tested logic to button clicks.

## File summary

**New:**
- `components/WatchImportGuide.tsx`
- `components/WatchImportActivityPicker.tsx`
- `components/WatchImportLapEditor.tsx`
- `lib/stravaLaps.ts`, `lib/stravaLaps.test.ts`
- `app/api/strava/activities/route.ts`, `app/api/strava/activities/route.test.ts`
- `app/api/strava/activities/[id]/laps/route.ts`, `app/api/strava/activities/[id]/laps/route.test.ts`

**Modified:**
- `lib/stravaClient.ts`
- `lib/stravaTypes.ts`
- `lib/reportStorage.ts`
- `components/ReportPanel.tsx`
- `app/app/page.tsx`
