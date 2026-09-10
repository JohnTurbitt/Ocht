# Live Logger — Dedicated Page Redesign

**Date:** 2026-08-24
**Status:** Approved for planning
**Supersedes (in part):** `docs/superpowers/specs/2026-08-17-live-race-logger-design.md`'s "Where this lives in the app" and "Live screen design" sections. Everything else in that spec (data model, roxzone handling, wake lock, testing conventions) is unchanged and still applies.

## Why this change

The live logger shipped (branch `JT-5`) as a state swapped into `app/app/page.tsx`'s existing content slot — same tab bar, same page chrome as manual entry, reached via a "Log live" button. That was a deliberate call in the original spec ("Not a new route... belongs in the same component tree").

Using it revealed that call was wrong for what this feature actually is: a race-day, one-handed, glance-at-your-wrist tool. It needs to feel like Strava's record screen — full-bleed, minimal chrome, one dominant stat — not a state hidden inside a report-building form. A mockup exploring that direction was reviewed and approved (three screens: setup, live recording, splits drawer) — this spec formalizes it and works out what it costs to build.

## Approved visual direction

Three screens, dark theme only (this is a recording/race-day screen, not a themed content page — see "Theming" below):

1. **Setup** — full-bleed, own screen. Format/level/target picker, same fields as today's `LiveSessionSetup`, no visible tab bar or report-page furniture nearby.
2. **Live recording** — minimal top bar (exit control + `STATION X/8 · SEG Y/16` counter). One dominant hero stat: the current segment's elapsed timer, large. The station-progress octagon shrinks to a small status badge near the top of the hero area instead of sharing top billing. The split list is not visible by default — a grabber handle at the bottom hints it's reachable.
3. **Splits drawer** — pulled up over the live screen (bottom sheet), showing the running split list. Reviewing pace mid-session (the original reason the list existed) still works; it just isn't permanently taking up space.

The tap-to-lap button, undo, wake lock, autosave-on-every-tap, the finish beat, and the optional official-finish-time prompt are unchanged in behavior — only their container changes.

## Routing

**New route: `app/app/live/page.tsx`** (nested under the existing `/app` route, not top-level). Reasoning: this stays part of the signed-in-or-not "app" experience — same `noindex` layout (`app/app/layout.tsx`), same need to work both signed in and anonymous, same underlying data (`RaceFormat`, `Level`, station definitions) — without inheriting any of `/app`'s own page-level state (tabs, form fields, saved-reports list).

**Single route, internal stage state** — not separate `/app/live/new` vs `/app/live/session` routes. `app/app/live/page.tsx` holds its own `stage: "setup" | "tracking"` state (the same shape `app/app/page.tsx` already has today, just relocated), swapping between `LiveSessionSetup` and `LiveSessionTracker` internally. Two real routes would need URL state or query params to represent stage, plus back-button semantics to work out (does browser back from "tracking" go to "setup" and lose progress, or exit the page?) for no real benefit — a session in progress is not naturally bookmarkable or shareable, so there's nothing an actual URL split would buy that internal state doesn't already give us today.

**Entry**: `SplitForm`'s "Log live" button changes from calling an `onStartLiveSession` callback that set `app/app/page.tsx`'s local state, to a plain navigation — `<Link href="/app/live">`. `app/app/page.tsx` loses `liveSessionStage`, `liveSessionConfig`, `liveSessionDraftToResume`, `startLiveSession()`, and the three-way conditional render entirely; `SplitForm` is once again the only thing rendered in that slot.

**Resume-on-load**: today, `startLiveSession()` checks `loadDraft()` before deciding whether to show setup or tracking, with a `window.confirm()` prompt to resume. That check moves to `app/app/live/page.tsx`'s mount — landing on `/app/live` (from any entry point, including a bookmark or a reopened tab) checks for a draft immediately and offers to resume before rendering setup, exactly as today, just relocated. The confirm-dialog UX (native `window.confirm`) is unchanged here — the earlier code review flagged it as inconsistent with the app's usual custom-modal pattern (`SettingsModal`'s delete-confirm), but that's a separate, non-blocking polish item, not part of this redesign's scope.

**Exit**: the top bar's exit control (`‹` on setup, `✕` on tracking) navigates back to `/app`. If tracking is mid-session, exiting does **not** discard the draft — it's still autosaved on every tap, so leaving and later returning via "Log live" resumes it, same as today's tab-switch-survival guarantee. No confirmation dialog on exit (unlike a "delete" action, leaving isn't destructive — the draft is safe).

## The report-generation problem this creates

This is the part that isn't just a styling change. Today, `LiveSessionTracker`'s `onFinish` handler calls `generateAndSaveReport(...)` — a function that was deliberately extracted from `handleSubmit` in Task 6 of the original build, but **only as far as living inside `app/app/page.tsx` as a closure**. A recent code review of that extraction confirmed this directly: `generateAndSaveReport` still closes over `savedReports`, `user`, `beginnerGuideDismissed`, `fullReportUnlocked`, `hasGeneratedReportEver`, `reportRef`, and roughly eight setters — it is reusable *within* `app/app/page.tsx`, not portable outside it.

Once the live logger is a separate page, it can no longer call that function. Three options:

1. **Duplicate the generate/save/reveal logic** into `app/app/live/page.tsx`. Rejected — this is exactly the ~100 lines of state-coupled logic Task 6 was built to avoid duplicating, and duplicating it now would mean every future change to report generation needs to happen in two places.
2. **Extract a shared hook** (e.g. `lib/hooks/useReportGeneration.ts`) that owns the report-generation/save logic and returns both a `generateAndSaveReport` function and the pieces of state it needs to expose (`generatingReport`, the generated `analysis`, `showResultsReveal`, etc.), callable from both `app/app/page.tsx` and `app/app/live/page.tsx`. Each page still owns what's specific to it (its own `savedReports` list load, its own `user` fetch) but shares the actual generate/save/reveal mechanics.
3. **Live page does its own minimal save, then redirects to `/app`** to show the reveal there. Rejected — this reintroduces coupling in the other direction (`/app` would need to detect "a live session just finished" and know to show a reveal on load), and splits the "was this session saved successfully" moment away from the screen the user is actually looking at.

**Decision: option 2.** `generateAndSaveReport` and its closely-coupled state (the `generatingReport` flag, the resulting `Analysis`, the `showResultsReveal`/`revealIsPb` flags, the toast-on-remote-save-failure path) move into a shared hook. `app/app/page.tsx`'s `handleSubmit` and `app/app/live/page.tsx`'s `onFinish` handler both call the same hook instance's `generateAndSaveReport`. Each page still renders its own `ReportGenerationOverlay`/`ResultsReveal` using the hook's returned state — those two components are already portable (take props, no page-specific coupling), so this is wiring, not a rewrite of them.

**Page-specific behavior doesn't move into the hook.** Today's closure does a few things that are genuinely page-specific, not shared mechanics: `setActiveTab("new")`, `dismissBeginnerGuide(...)`, the `hasGeneratedReportEver` localStorage flag, and the `reportRef.current?.scrollIntoView(...)` call. None of those make sense inside a hook meant to be called from two different pages — `activeTab` doesn't exist on `/app/live`, and there's no `reportRef` to scroll to there either. The hook takes an optional `onSaved?: () => void` callback, invoked once the report is generated and saved (success path only, not the remote-save-failure path, which the hook already handles itself via the toast). `app/app/page.tsx` passes `onSaved: () => { setActiveTab("new"); dismissBeginnerGuideIfNeeded(); scrollToReport(); }` (its existing behavior, unchanged). `app/app/live/page.tsx` passes `onSaved: () => router.push("/app")` — once the reveal is dismissed and the report is saved, it navigates back to `/app`'s "new" tab (the default tab, so no explicit tab-state needs passing across the navigation), where the user sees the report in normal context (`ReportPanel`, history) rather than the live page trying to become a second report-viewing surface. The `hasGeneratedReportEver` first-report flag is content-agnostic (true regardless of which page generated the report), so it can live inside the hook itself rather than either page's `onSaved`.

## Theming

The three mockup screens are dark-only, not theme-reactive — this mirrors Strava's own record screen (which stays dark regardless of system theme, for outdoor visibility/battery). This is a deliberate scope call: **`app/app/live/page.tsx` always renders in the dark palette**, ignoring the user's light/dark preference from `lib/preferences.ts`. This is a product decision worth confirming explicitly since it's a real behavior change (today's embedded version respects the user's theme choice, including the light-theme contrast fix from `styles/_live-session.scss`) — flagging it here rather than assuming it silently.

## What's unchanged

Everything in the original spec's "Data model & persistence," "Roxzone," "Screen Wake Lock," and "Testing" sections carries over as-is: `lib/liveSession.ts`'s draft shape and persistence, `lib/wakeLock.ts`, the official-finish-time prompt feeding `officialFinishTime` into the unmodified `buildAnalysis`, and the pure-logic-tested/presentational-verified-by-eye testing convention.

## Components

**New:**
- `app/app/live/page.tsx` — the new dedicated route. Owns `stage`, the resume-on-load check, and renders `LiveSessionSetup`/`LiveSessionTracker` plus the shared report-generation hook's overlay/reveal.
- `lib/hooks/useReportGeneration.ts` — the extracted, portable generate/save/reveal hook (see above).

**Modified:**
- `app/app/page.tsx` — removes `liveSessionStage`/`liveSessionConfig`/`liveSessionDraftToResume` state, `startLiveSession()`, and the three-way conditional render around `<SplitForm>` (reverting to always rendering `SplitForm` in that slot). `handleSubmit` now calls the shared hook's `generateAndSaveReport` instead of an in-component version.
- `components/SplitForm.tsx` — `onStartLiveSession` prop becomes a plain `<Link href="/app/live">` (or the prop is removed entirely in favor of the component doing its own `Link`, whichever reads cleaner once implemented — a plan-level detail, not a design decision).
- `components/LiveSessionSetup.tsx`, `components/LiveSessionTracker.tsx` — visual rework to match the approved mockup (compact octagon badge, hero timer, splits drawer instead of inline list). Props/behavior contract stays close to what exists today; this is a visual pass on existing components, not a rebuild from scratch.
- `styles/_live-session.scss` — substantial rework for the new layout (drawer, hero timer sizing, minimal top bar). The light-theme contrast fix becomes moot for the parts of the screen that are now permanently dark, per the theming decision above.

## Out of scope (unchanged from original spec, still holds)

Voice logging, custom race formats, a review/edit screen before report generation, full offline/PWA support, true per-transition roxzone tracking — none of that changes here.

## Testing

Same convention as before: `lib/hooks/useReportGeneration.ts` gets logic-level test coverage where it's meaningfully testable in isolation (the parts that don't require a real DOM/router); the page components and visual rework are verified by eye in both the setup and tracking flows, plus the resume-on-load and exit-preserves-draft paths, since those are the behaviors most likely to regress in the move from embedded state to a real route.
