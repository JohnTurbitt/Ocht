# Live Logger Dedicated Page + Nav Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the live tap-to-lap logger out of `app/app/page.tsx`'s embedded state into its own dedicated route (`app/app/live/page.tsx`), restyle it as a full-bleed, Strava-inspired recording screen, and give it a prominent nav entry point — a raised, brand-styled "Record" button in the mobile bottom nav and a standout pill in the desktop tab row — replacing the plain "Log live" button that used to live inside the manual-entry form.

**Architecture:** The trickiest part is that today's `generateAndSaveReport` only works because it's a closure inside `app/app/page.tsx`, tangled up with ~8 pieces of that page's own state. This plan extracts it into a shared hook (`lib/hooks/useReportGeneration.ts`) *before* building the new route, so both pages call the same, already-working generate/save logic — no duplicated report-generation code. Everything else (draft persistence, tap math, roxzone capture, wake lock) is untouched; only where the live screens live and how they look changes.

**Tech Stack:** Next.js 15 App Router, TypeScript, React state, `next/navigation`'s `useRouter`, SCSS.

**Full specs:**
- `docs/superpowers/specs/2026-08-24-live-logger-dedicated-page-design.md`
- `docs/superpowers/specs/2026-08-24-nav-redesign.md`

---

### Task 1: `lib/hooks/useReportGeneration.ts` — extract the portable report-generation hook

**Files:**
- Create: `lib/hooks/useReportGeneration.ts`

This is a **behavior-preserving extraction** of `app/app/page.tsx`'s current `generateAndSaveReport` function (lines 704-846) plus the state it manages (`generatingReport`, `analysis`, `showResultsReveal`, `revealIsPb`). Page-specific side effects that don't belong in a shared hook (`setActiveTab`, `dismissBeginnerGuide`, the `hasGeneratedReportEver` flag, `setViewingSavedReport`, `setValidationErrors`/`setFieldErrors`, scrolling to `reportRef`) move to two optional callbacks the hook invokes instead of doing itself: `onSaved` (success only) and `onSettled` (both success and the remote-save-failure path — matches today's code, where `setValidationErrors([])`/`setFieldErrors({})`/the scroll-into-view happen in *both* branches).

- [ ] **Step 1: Write the hook**

Create `lib/hooks/useReportGeneration.ts`:

```ts
"use client";

import { useState } from "react";
import {
  Analysis,
  Level,
  Station,
  StationKey,
  buildAnalysis,
} from "@/lib/analysis";
import { RaceFormat } from "@/lib/raceFormats";
import { AuthUser, saveRemoteReport } from "@/lib/apiClient";
import { SavedReport, saveReports } from "@/lib/reportStorage";
import { groupKeyForReport, isNewPersonalBest } from "@/lib/progress";
import { TrainingContext, hasTrainingContext } from "@/lib/trainingContext";
import { trackEvent } from "@/lib/analytics";
import type { ToastMessage } from "@/components/Toast";

export type GenerateReportInput = {
  goal: string;
  targetTime: string;
  level: Level;
  runs: string[];
  stationSplits: Record<StationKey, string>;
  stationDefinitions: Station[];
  raceFormat: RaceFormat;
  officialFinishTime: string;
  trainingContext: TrainingContext;
};

export type UseReportGenerationOptions = {
  user: AuthUser | null;
  savedReports: SavedReport[];
  setSavedReports: (reports: SavedReport[]) => void;
  setToast: (toast: ToastMessage) => void;
  fullReportUnlocked: boolean;
  // Called once the report has been generated and saved successfully —
  // for page-specific side effects (e.g. switching tabs). Not called on
  // the remote-save-failure path (the report still shows, but nothing
  // page-specific about "success" happened).
  onSaved?: () => void;
  // Called after the async work finishes, on BOTH the success and the
  // remote-save-failure path — for page-specific cleanup that should
  // happen regardless of outcome (e.g. clearing validation-error state,
  // scrolling to where the report now renders).
  onSettled?: () => void;
};

export function useReportGeneration({
  user,
  savedReports,
  setSavedReports,
  setToast,
  fullReportUnlocked,
  onSaved,
  onSettled,
}: UseReportGenerationOptions) {
  const [generatingReport, setGeneratingReport] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [showResultsReveal, setShowResultsReveal] = useState(false);
  const [revealIsPb, setRevealIsPb] = useState(false);

  async function generateAndSaveReport(input: GenerateReportInput) {
    const {
      goal,
      targetTime,
      level,
      runs,
      stationSplits,
      stationDefinitions,
      raceFormat,
      officialFinishTime,
      trainingContext,
    } = input;

    setGeneratingReport(true);
    // Hold the generation overlay long enough to read as intentional, even
    // though the math is synchronous and any remote save is usually fast.
    const minimumHold = new Promise<void>((resolve) =>
      window.setTimeout(resolve, 1700),
    );

    const generatedAnalysis = buildAnalysis(
      goal,
      targetTime,
      level,
      runs,
      stationSplits,
      stationDefinitions,
      raceFormat,
      officialFinishTime,
    );
    const savedReport: SavedReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      raceFormat,
      goal,
      targetTime,
      officialFinishTime: officialFinishTime || undefined,
      level,
      runs,
      stationDefinitions:
        raceFormat === "custom" ? stationDefinitions : undefined,
      stationSplits,
      trainingContext: hasTrainingContext(trainingContext)
        ? trainingContext
        : undefined,
      finishSeconds: generatedAnalysis.finishSeconds,
      predictedTargetSeconds: generatedAnalysis.predictedTargetSeconds,
      topLeakLabel: generatedAnalysis.topLeaks[0]?.label ?? "",
    };
    let nextReports = [savedReport, ...savedReports].slice(0, 12);

    if (user) {
      try {
        const remoteReport = await saveRemoteReport({
          goal,
          targetTime,
          level,
          raceFormat,
          runs,
          stationDefinitions:
            raceFormat === "custom" ? stationDefinitions : undefined,
          stationSplits,
          trainingContext: hasTrainingContext(trainingContext)
            ? trainingContext
            : undefined,
        });

        nextReports = [remoteReport, ...savedReports];
      } catch (error) {
        await minimumHold;
        setGeneratingReport(false);
        setAnalysis(generatedAnalysis);
        setToast({
          id: Date.now(),
          title: "Report generated",
          message:
            error instanceof Error
              ? `${error.message} The report is visible below but was not saved.`
              : "The report is visible below but was not saved to your account.",
          tone: "error",
        });
        onSettled?.();
        return;
      }
    } else {
      saveReports(nextReports);
    }

    await minimumHold;
    setGeneratingReport(false);
    setAnalysis(generatedAnalysis);
    setRevealIsPb(
      isNewPersonalBest(
        savedReports,
        generatedAnalysis.finishSeconds,
        groupKeyForReport(savedReport),
      ),
    );
    setShowResultsReveal(true);
    setSavedReports(nextReports);
    trackEvent("report_generated", {
      race_format: raceFormat,
      signed_in: Boolean(user),
      premium: fullReportUnlocked,
      saved_remote: Boolean(user),
      run_count: runs.length,
      station_count: stationDefinitions.length,
    });
    onSaved?.();
    onSettled?.();
  }

  return {
    generatingReport,
    analysis,
    showResultsReveal,
    setShowResultsReveal,
    revealIsPb,
    generateAndSaveReport,
  };
}
```

- [ ] **Step 2: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors. (Not called anywhere yet — this only catches syntax/type mistakes in the new file itself.)

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useReportGeneration.ts
git commit -m "Add useReportGeneration hook, extracted for reuse by the live logger's own page"
```

---

### Task 2: Wire the hook into `app/app/page.tsx`

**Files:**
- Modify: `app/app/page.tsx`

Another **behavior-preserving refactor** — replace the in-component `generateAndSaveReport` and its four pieces of state with the hook, using `onSaved`/`onSettled` to replicate every existing side effect exactly.

- [ ] **Step 1: Add the import**

Add near the other `@/lib/*` imports in `app/app/page.tsx`:

```tsx
import { useReportGeneration } from "@/lib/hooks/useReportGeneration";
```

- [ ] **Step 2: Replace the four pieces of state with the hook**

Find and delete these lines (currently among the other `useState` declarations):

```tsx
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
```

```tsx
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showResultsReveal, setShowResultsReveal] = useState(false);
```

```tsx
  const [revealIsPb, setRevealIsPb] = useState(false);
```

(Keep every other `useState` line exactly as-is — only these four move into the hook.)

**Move `fullReportUnlocked`'s declaration earlier.** It currently reads `const fullReportUnlocked = user?.subscription === "ACTIVE";` further down the file (around where `isExperiencedUser` is computed). Cut that single line and move it to sit directly above the new `useReportGeneration` call added in this step — everywhere else that already reads `fullReportUnlocked` keeps working unchanged, since it's still the same `const` in the same component scope, just declared earlier.

Immediately after the existing `activeStationDefinitions` computation (right after the `useState` block, before the `preview` `useMemo`), add:

```tsx
  const fullReportUnlocked = user?.subscription === "ACTIVE";

  const {
    generatingReport,
    analysis,
    showResultsReveal,
    setShowResultsReveal,
    revealIsPb,
    generateAndSaveReport,
  } = useReportGeneration({
    user,
    savedReports,
    setSavedReports,
    setToast,
    fullReportUnlocked,
    onSaved: () => {
      setViewingSavedReport(false);
      setActiveTab("new");
      if (!beginnerGuideDismissed) {
        dismissBeginnerGuide("beginner_guide_completed_by_report");
      }
      if (!hasGeneratedReportEver) {
        window.localStorage.setItem(hasGeneratedReportKey, "true");
        setHasGeneratedReportEver(true);
      }
    },
    onSettled: () => {
      setValidationErrors([]);
      setFieldErrors({});
      window.requestAnimationFrame(() => {
        reportRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
  });
```

- [ ] **Step 3: Delete the old `generateAndSaveReport` function entirely**

Delete the full `async function generateAndSaveReport(input: {...}) { ... }` block (currently lines 704-846) — it's now the hook's job.

- [ ] **Step 4: `handleSubmit` needs no change**

`handleSubmit`'s call to `generateAndSaveReport({...})` stays exactly as it is — it now calls the hook's returned `generateAndSaveReport` instead of the deleted local function, with an identical call signature.

- [ ] **Step 5: Verify types check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass — this is a pure refactor.

- [ ] **Step 7: Manually verify manual report generation still works**

Run: `npm run dev`, open `/app`, click "Load sample race", submit, confirm the report generates and reveals exactly as before (generation overlay → results reveal → report visible → scrolled into view). Also verify submitting with invalid input still shows the validation toast. Stop the dev server after checking.

- [ ] **Step 8: Commit**

```bash
git add app/app/page.tsx
git commit -m "Wire app/app/page.tsx's manual-entry flow through the shared useReportGeneration hook"
```

---

### Task 3: Remove the embedded live-session flow from `app/app/page.tsx` and `SplitForm.tsx`

**Files:**
- Modify: `app/app/page.tsx`
- Modify: `components/SplitForm.tsx`

The live logger is about to get its own route (Task 6) — this task removes the old embedded version first, so there's a clean baseline before the new route lands. `SplitForm` reverts to being the only thing rendered in that content slot, exactly as it was before the live logger existed.

- [ ] **Step 1: Remove live-session state from `app/app/page.tsx`**

Delete these three `useState` declarations:

```tsx
  const [liveSessionStage, setLiveSessionStage] = useState<"idle" | "setup" | "tracking">("idle");
  const [liveSessionConfig, setLiveSessionConfig] = useState<{
    raceFormat: LiveSessionFormat;
    level: Level;
    targetTime: string;
  } | null>(null);
  const [liveSessionDraftToResume, setLiveSessionDraftToResume] =
    useState<LiveSessionDraft | null>(null);
```

- [ ] **Step 2: Remove `startLiveSession` and the `resumableLiveDraft` computation**

Delete the full `function startLiveSession() { ... }` block (the one that calls `loadDraft()` and shows a `window.confirm` resume prompt), and delete the `persistedLiveDraft`/`resumableLiveDraft` computation that currently sits just above the `return (` statement (the block with the comment about `loadDraft` being read fresh on every render).

- [ ] **Step 3: Simplify the conditional render back to always-`SplitForm`**

Find:

```tsx
        {activeTab === "new" ? (
          <>
            {viewingSavedReport ? null : liveSessionStage === "setup" ? (
              <LiveSessionSetup
                ...
              />
            ) : liveSessionStage === "tracking" && liveSessionConfig ? (
              <LiveSessionTracker
                ...
              />
            ) : (
            <SplitForm
              ...
              onStartLiveSession={startLiveSession}
              ...
            />
            )}
```

Replace with:

```tsx
        {activeTab === "new" ? (
          <>
            {viewingSavedReport ? null : (
              <SplitForm
                raceFormat={raceFormat}
                fullReportUnlocked={fullReportUnlocked}
                showStartGuide={!isExperiencedUser}
                onShowGuide={() => {
                  setDemoOpen(true);
                  trackEvent("beginner_demo_opened");
                }}
                goal={goal}
                targetTime={targetTime}
                officialFinishTime={officialFinishTime}
                level={level}
                runs={runs}
                stationDefinitions={activeStationDefinitions}
                stationSplits={stationSplits}
                trainingContext={trainingContext}
                stravaConnected={stravaConnected}
                errors={validationErrors}
                fieldErrors={fieldErrors}
                customTemplates={customTemplates}
                onRaceFormatChange={applyRaceFormat}
                onCustomFormatClick={activateCustomFormat}
                onAddRun={addRunSplit}
                onRemoveRun={removeRunSplit}
                onAddCustomStation={addCustomStation}
                onRemoveCustomStation={removeCustomStation}
                onCustomStationLabelChange={updateCustomStationLabel}
                onSaveCustomTemplate={saveCurrentCustomTemplate}
                onLoadCustomTemplate={(template) =>
                  applyReportPreset(template)
                }
                onDeleteCustomTemplate={deleteCustomTemplate}
                onGoalChange={setGoal}
                onTargetTimeChange={updateTargetTime}
                onOfficialFinishChange={setOfficialFinishTime}
                onLevelChange={setLevel}
                onRunChange={updateRun}
                onStationChange={updateStation}
                onTrainingContextChange={updateTrainingContext}
                onLoadSample={() =>
                  applyReportPreset(sampleReportPreset)
                }
                onResetDefaults={() =>
                  applyReportPreset(buildUserDefaultPreset(user))
                }
                onClearForm={() => {
                  setTrainingContext(emptyTrainingContext);
                  applyReportPreset(
                    buildEmptyPresetForCurrentFormat({
                      raceFormat,
                      level,
                      runCount: runs.length,
                      stationDefinitions: activeStationDefinitions,
                    }),
                  );
                }}
                onSubmit={handleSubmit}
              />
            )}
```

(Every prop is identical to what was already there — the only change is removing the `liveSessionStage`/`liveSessionConfig` branches and the now-deleted `onStartLiveSession` prop.)

- [ ] **Step 4: Remove now-unused imports**

Remove these, since nothing in the file references them anymore after Steps 1-3:

```tsx
import { LiveSessionSetup } from "@/components/LiveSessionSetup";
import { LiveSessionTracker } from "@/components/LiveSessionTracker";
```

Then check the `@/lib/liveSession` import:

```tsx
import {
  LiveSessionDraft,
  LiveSessionFormat,
  clearDraft,
  loadDraft,
} from "@/lib/liveSession";
```

Run `grep -n "LiveSessionDraft\|LiveSessionFormat\|clearDraft\|loadDraft" app/app/page.tsx` — if it shows only this import line itself (no other usages remain after Steps 1-3), delete the whole import line.

- [ ] **Step 5: Remove `onStartLiveSession` from `SplitForm.tsx`**

In `components/SplitForm.tsx`, remove this line from `SplitFormProps`:

```tsx
  onStartLiveSession: () => void;
```

Remove `onStartLiveSession,` from the destructured props in the component's parameter list.

Find and delete the "Log live" button in the preset-actions block (sits between "Clear form" and "How it works"):

```tsx
            <button
              type="button"
              onClick={(e) => {
                onStartLiveSession();
                e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
              }}
            >
              Log live
            </button>
```

Read the actual current file first to confirm this matches exactly (surrounding code may have shifted slightly since this plan was written) before deleting.

- [ ] **Step 6: Verify types check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass, no regressions.

- [ ] **Step 8: Manually verify**

Run: `npm run dev`, open `/app`. Confirm: no "Log live" button anywhere in the preset-actions row, manual entry still works end-to-end (submit → report), no console errors. Stop the dev server after checking.

- [ ] **Step 9: Commit**

```bash
git add app/app/page.tsx components/SplitForm.tsx
git commit -m "Remove the embedded live-session flow ahead of its dedicated page"
```

---

### Task 4: `components/RecordBadge.tsx` — the shield-in-a-circle mark

**Files:**
- Create: `components/RecordBadge.tsx`
- Create: `styles/_record-badge.scss`
- Modify: `app/globals.scss`

- [ ] **Step 1: Write the component**

Create `components/RecordBadge.tsx`:

```tsx
/**
 * The shield mark on a solid lime circle — used for the "Record live" nav
 * entry point (the raised mobile bottom-nav button and the desktop tab-row
 * pill; see docs/superpowers/specs/2026-08-24-nav-redesign.md). Renders its
 * own copy of the shield path with inverted (dark-on-lime) coloring, since
 * OchtShield's fills are hardcoded to brand lime for the opposite case (a
 * lime shield on a dark background) — the same kind of duplication
 * ReportGenerationOverlay's ring already uses, for the same reason.
 *
 * Sizing is controlled entirely by the wrapping element's CSS (width/height
 * on `.record-badge`), not a prop — it renders at two very different sizes
 * depending on breakpoint, and CSS is what actually varies there.
 */
export function RecordBadge({ className }: { className?: string }) {
  return (
    <span
      className={className ? `record-badge ${className}` : "record-badge"}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 78" className="record-badge__icon">
        <path
          className="record-badge__shield"
          d="M32 2L62 16V44C62 60 32 76 32 76C32 76 2 60 2 44V16L32 2Z"
        />
        <text
          className="record-badge__glyph"
          x="32"
          y="52"
          textAnchor="middle"
          fontFamily="var(--font-display), sans-serif"
          fontWeight="900"
          fontSize="34"
        >
          8
        </text>
      </svg>
    </span>
  );
}
```

- [ ] **Step 2: Write the styles**

Create `styles/_record-badge.scss`:

```scss
.record-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  // Always brand lime in both themes (like --action-bg), not var(--lime) —
  // this is a filled action button, not themed content.
  background: radial-gradient(circle at 35% 30%, #d8ff6a, #b6ef00 60%, #94c700 100%);
}

.record-badge__icon {
  width: 60%;
  height: 60%;
}

.record-badge__shield {
  fill: rgba(14, 25, 20, 0.08);
  stroke: #0e1914;
  stroke-width: 2;
}

.record-badge__glyph {
  fill: #0e1914;
}
```

Register it in `app/globals.scss` (add after the last existing `@use` line):

```scss
@use "../styles/record-badge";
```

- [ ] **Step 3: Verify types check and the build compiles**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors. (Not mounted anywhere yet — this only proves it compiles.)

- [ ] **Step 4: Commit**

```bash
git add components/RecordBadge.tsx styles/_record-badge.scss app/globals.scss
git commit -m "Add RecordBadge component"
```

---

### Task 5: Restyle the nav — Record button + underline tabs

**Files:**
- Modify: `app/app/page.tsx`
- Modify: `styles/_layout.scss`

The `.tab-bar` JSX and CSS. This task depends on Task 4 (`RecordBadge`) but not on Task 6 (the new route) — the link can point at `/app/live` before that route exists (it'll 404 until Task 6 lands; expected mid-plan).

- [ ] **Step 1: Update the `.tab-bar` JSX in `app/app/page.tsx`**

Add the import:

```tsx
import { RecordBadge } from "@/components/RecordBadge";
```

Find the `<nav className="tab-bar" ...>` block. Delete the "Events" button entirely (the last button in the nav, `className="tab-bar__tab tab-bar__tab--events"`, which calls `setEventsSheetOpen(true)`). Events stays reachable via the header's `UpcomingEventsMenu`, unchanged — see the nav-redesign spec's "Decision: Events moves out of the bottom bar".

Insert the Record link between the "Compare" button and the "Records" button — right after Compare's closing `</button>`, right before Records' opening `<button`:

```tsx
          <Link
            href="/app/live"
            className="tab-bar__tab tab-bar__record"
            onClick={() =>
              trackEvent("live_session_entry_clicked", { signed_in: Boolean(user) })
            }
          >
            <span className="tab-bar__record-rings" aria-hidden="true">
              <span className="tab-bar__record-ring" />
              <span className="tab-bar__record-ring" />
            </span>
            <RecordBadge className="tab-bar__record-badge" />
            <span className="tab-bar__label">Record</span>
          </Link>
```

`Link` (from `next/link`) and `trackEvent` are both already imported in this file.

**Note on placement:** this puts Record between Compare and Records in DOM order — five slots end up New, Progress, Compare, **Record**, Records for the mobile grid. Keep Step 2's `grid-template-columns` mapping and Step 3's `order: 5` desktop rule consistent with wherever it actually ends up in the DOM if you place it differently.

- [ ] **Step 2: Rewrite the mobile (`max-width: 640px`) tab-bar CSS**

In `styles/_layout.scss`, find the `@media (max-width: 640px) { .tab-bar { ... } ... }` block (the comment above it reads `/* Mobile: turn the top tab bar into a sticky bottom nav */`). Replace its full contents with:

```scss
/* Mobile: turn the top tab bar into a sticky bottom nav */
@media (max-width: 640px) {
  .tab-bar {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 110;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 78px 1fr;
    gap: 0;
    flex-wrap: nowrap;
    border-top: 1px solid var(--line);
    border-bottom: none;
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom, 0px));
    background: var(--panel);
  }

  .tab-bar__tab {
    position: relative;
    flex-direction: column;
    gap: 4px;
    min-height: 54px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.04em;
  }

  .tab-bar__tab:hover {
    border: 0;
    background: transparent;
    color: var(--muted);
  }

  .tab-bar__tab.is-active {
    border: 0;
    background: transparent;
    color: var(--teal);
  }

  .tab-bar__icon {
    display: block;
  }

  .tab-bar__label {
    font-size: 0.66rem;
  }

  .tab-bar__tab span:not(.tab-bar__label):not(.tab-bar__record-rings) {
    position: absolute;
    top: 2px;
    right: 50%;
    margin-right: -26px;
    min-width: 18px;
    height: 18px;
    font-size: 0.66rem;
  }

  // The record link needs an explicit height so its raised badge's negative
  // offset is calculated from THIS row's actual top edge. Without it, the
  // link collapses to near-zero height (all its children are
  // position:absolute, so none of them contribute to normal-flow height)
  // and gets vertically centered by the grid, which puts the "raise" at
  // the row's middle instead of its top — the button reads as sunk into
  // the bar instead of clearly rising above it.
  .tab-bar__record {
    position: relative;
    height: 100%;
    justify-content: flex-start;
    background: transparent;
    padding: 0;
  }

  .tab-bar__record-badge {
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    width: 62px;
    height: 62px;
    box-shadow:
      0 8px 20px -4px rgba(200, 255, 46, 0.45),
      0 0 0 6px var(--panel);
  }

  .tab-bar__record-rings {
    display: block;
  }

  .tab-bar__record-ring {
    position: absolute;
    top: -30px;
    left: 50%;
    width: 62px;
    height: 62px;
    margin-left: -31px;
    border-radius: 50%;
    border: 1px solid rgba(200, 255, 46, 0.4);
    animation: tab-bar-record-pulse 2.2s ease-out infinite;
  }

  .tab-bar__record-ring:nth-child(2) {
    animation-delay: 0.7s;
  }

  .tab-bar__record .tab-bar__label {
    position: absolute;
    top: 36px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--lime);
    font-size: 0.6rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .tab-bar__record-ring {
      animation: none;
    }
  }

  body {
    padding-bottom: calc(66px + env(safe-area-inset-bottom, 0px));
  }
}

@keyframes tab-bar-record-pulse {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1.55);
    opacity: 0;
  }
}
```

(The keyframe is declared outside the media query, same as the existing `station-octagon-pulse` keyframe convention in `_report.scss`.)

- [ ] **Step 3: Rewrite the desktop (default) tab-bar CSS**

In the same file, find the desktop block — `.tab-bar { ... }` through `.tab-bar__tab--events { display: none; }` (right before `.cookie-banner`). Replace the whole block with:

```scss
.tab-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 22px;
  border-bottom: 1px solid var(--line);
  padding-bottom: 12px;
}

.tab-bar__tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: auto;
  min-height: 0;
  margin: 0;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  padding: 0 2px 10px;
  background: transparent;
  color: var(--muted);
  font-weight: 700;
}

.tab-bar__tab:hover,
.tab-bar__tab.is-active {
  border-bottom-color: var(--action-bg);
  background: transparent;
  color: var(--ink);
}

.tab-bar__tab span:not(.tab-bar__label) {
  display: inline-grid;
  min-width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  /* --action-bg (not --lime) so this dark-text-on-bright-fill badge stays
     legible in light mode too — --lime is now teal in light theme. */
  background: var(--action-bg);
  color: #0a1711;
  font-size: 0.8rem;
}

.tab-bar__icon {
  display: none;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.tab-bar__record {
  order: 5;
  margin-left: auto;
  gap: 8px;
  border-bottom-color: transparent;
  border-radius: 999px;
  padding: 6px 18px 6px 6px;
  background: var(--action-bg);
  color: var(--action-text);
  font-weight: 800;
}

.tab-bar__record:hover,
.tab-bar__record.is-active {
  border-bottom-color: transparent;
  background: var(--action-bg);
  color: var(--action-text);
}

.tab-bar__record-badge {
  width: 24px;
  height: 24px;
}

.tab-bar__record-rings {
  display: none;
}
```

- [ ] **Step 4: Verify types check, lint, and the build compiles**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`, open `/app`.

- Desktop width: confirm New report / Progress / Compare / Records now show as underlined text tabs, and a lime "Record" pill sits at the right end of the row with the shield badge. Clicking it will currently 404 (expected — the route lands in Task 6).
- Narrow below 640px (or use device emulation): confirm the bottom nav shows New / Progress / Compare / Records with the Record button raised above the bar, rings pulsing continuously, "Record" label beneath the badge. Confirm the Events button is gone (still reachable via the header calendar icon).
- Check `prefers-reduced-motion: reduce` — rings should render static.
- Check light and dark theme — the nav is part of the regular themed app shell (unlike the live page itself, which stays dark-only), so it must look correct in both.

Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add app/app/page.tsx styles/_layout.scss
git commit -m "Restyle the tab bar: Record replaces the plain Log-live entry point, Events moves to the header-only"
```

---

### Task 6: `components/LiveSessionTracker.tsx` visual rework (do this before Task 7)

**Files:**
- Modify: `components/LiveSessionTracker.tsx`
- Modify: `styles/_live-session.scss`

**Do this task before Task 7** (`app/app/live/page.tsx`) — Task 7's page passes a new `onExit` prop that this task adds; building the page first would leave it referencing a prop the component doesn't accept yet.

This is the highest-stakes visual task — the live-tap screen. **All existing state, handlers, and effects (wake lock + visibility-change reacquire, the 1-second timer interval, `handleTap`/`handleUndo`/`handleFinishTimeSubmit`, `resolveSegmentStart`) are unchanged.** Only the returned JSX changes: a minimal top bar (exit control + segment counter) replaces the old inline header, the elapsed timer becomes the dominant hero stat (Strava's single-stat principle) instead of living inside the tap button, the octagon shrinks to a compact status badge, and the split list becomes a pull-up drawer instead of a permanently visible list. A new `onExit: () => void` prop is added — the old embedded version had no explicit "leave" affordance (leaving meant switching app tabs); the dedicated page needs one.

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `components/LiveSessionTracker.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { StationProgressOctagon } from "./StationProgressOctagon";
import { Level } from "@/lib/analysis";
import {
  LiveSessionDraft,
  LiveSessionFormat,
  buildSegmentSequence,
  clearDraft,
  draftToReportInputs,
  isSessionComplete,
  recordLap,
  saveDraft,
  startDraft,
  undoLastLap,
} from "@/lib/liveSession";
import { StationKey } from "@/lib/analysis";
import { maskTimeInput, normalizeTimeInput } from "@/lib/validation";
import { releaseWakeLock, requestWakeLock } from "@/lib/wakeLock";

type LiveSessionTrackerProps = {
  raceFormat: LiveSessionFormat;
  level: Level;
  targetTime: string;
  initialDraft?: LiveSessionDraft;
  onExit: () => void;
  onFinish: (input: {
    runs: string[];
    stationSplits: Record<StationKey, string>;
    officialFinishTime: string;
  }) => void;
};

function formatSegmentTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

// The current (not-yet-tapped) segment's start time, resolved from the
// persisted draft when resuming (e.g. after a tab-switch remount) so the
// elapsed-time clock reflects when the segment actually began rather than
// resetting to "now". Falls back to "now" for a genuinely fresh session, or
// for an old/malformed draft that predates the currentSegmentStartedAt field.
function resolveSegmentStart(initialDraft?: LiveSessionDraft): number {
  const iso = initialDraft?.currentSegmentStartedAt;
  if (!iso) {
    return Date.now();
  }

  const parsed = new Date(iso).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function LiveSessionTracker({
  raceFormat,
  level,
  targetTime,
  initialDraft,
  onExit,
  onFinish,
}: LiveSessionTrackerProps) {
  const [draft, setDraft] = useState<LiveSessionDraft>(
    () => initialDraft ?? startDraft(raceFormat, level, targetTime),
  );
  const [elapsedOnCurrent, setElapsedOnCurrent] = useState(() =>
    Math.round((Date.now() - resolveSegmentStart(initialDraft)) / 1000),
  );
  const [stage, setStage] = useState<"tapping" | "beat" | "finishTime">(() =>
    initialDraft && isSessionComplete(initialDraft) ? "finishTime" : "tapping",
  );
  const [officialFinishTime, setOfficialFinishTime] = useState("");
  const [splitsOpen, setSplitsOpen] = useState(false);
  const justFinished = stage !== "tapping";
  const segmentStartRef = useRef<number>(resolveSegmentStart(initialDraft));
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const sequence = buildSegmentSequence(raceFormat);
  const currentIndex = draft.segments.length;
  const currentSegment = sequence[currentIndex];
  const doneStationCount = draft.segments.filter((s) => s.type === "station").length;
  const currentIsStation = currentSegment?.type === "station";

  useEffect(() => {
    let active = true;

    requestWakeLock().then((sentinel) => {
      if (active) {
        wakeLockRef.current = sentinel;
      } else {
        releaseWakeLock(sentinel);
      }
    });

    // The Screen Wake Lock API auto-releases the sentinel when the document
    // is hidden (tab backgrounded, phone locked) and does NOT reacquire it
    // automatically when the document becomes visible again. Re-request it
    // ourselves so an athlete who glances away or takes a call mid-race
    // doesn't come back to a dimmed/locked screen.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && active) {
        requestWakeLock().then((sentinel) => {
          if (active) {
            wakeLockRef.current = sentinel;
          } else {
            releaseWakeLock(sentinel);
          }
        });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock(wakeLockRef.current);
      wakeLockRef.current = null;
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedOnCurrent(Math.round((Date.now() - segmentStartRef.current) / 1000));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentIndex]);

  function handleTap() {
    if (!currentSegment) {
      return;
    }

    const nowMs = Date.now();
    const seconds = (nowMs - segmentStartRef.current) / 1000;
    const nextDraft = recordLap(draft, seconds, new Date(nowMs).toISOString());
    setDraft(nextDraft);
    saveDraft(nextDraft);
    segmentStartRef.current = nowMs;
    setElapsedOnCurrent(0);

    if (isSessionComplete(nextDraft)) {
      setStage("beat");
      window.setTimeout(() => {
        setStage("finishTime");
      }, 700);
    }
  }

  function handleFinishTimeSubmit() {
    clearDraft();
    onFinish({ ...draftToReportInputs(draft), officialFinishTime });
  }

  function handleUndo() {
    if (draft.segments.length === 0) {
      return;
    }

    const nowMs = Date.now();
    const nextDraft = undoLastLap(draft, new Date(nowMs).toISOString());
    setDraft(nextDraft);
    saveDraft(nextDraft);
    segmentStartRef.current = nowMs;
    setElapsedOnCurrent(0);
  }

  return (
    <div className="live-page">
      <div className="live-page__topbar">
        <button
          type="button"
          className="live-page__exit"
          onClick={onExit}
          aria-label="Exit session"
        >
          {stage === "finishTime" ? "✕" : "‹"}
        </button>
        <span className="live-page__topbar-label">
          {justFinished
            ? "FINISHED"
            : `STATION ${Math.min(doneStationCount + (currentIsStation ? 1 : 0), 8)}/8 · SEG ${currentIndex + 1}/16`}
        </span>
        <span className="live-page__topbar-spacer" aria-hidden="true" />
      </div>

      {stage === "finishTime" ? (
        <div className="live-session-tracker__finish-time">
          <label className="field">
            <span>Official finish time (optional)</span>
            <input
              value={officialFinishTime}
              onChange={(event) =>
                setOfficialFinishTime(maskTimeInput(event.target.value, "race"))
              }
              onBlur={(event) =>
                setOfficialFinishTime(normalizeTimeInput(event.target.value, "race"))
              }
              inputMode="numeric"
              placeholder="From the results board or your chip"
            />
          </label>
          <p className="live-session-tracker__finish-time-hint">
            Enter this to see your roxzone tax in the report — or leave it
            blank and continue without one.
          </p>
          <button
            type="button"
            className="live-session-tracker__continue"
            onClick={handleFinishTimeSubmit}
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          <div className="live-session-tracker__hero">
            <div className="live-session-tracker__badge">
              <StationProgressOctagon
                doneCount={justFinished ? 8 : doneStationCount}
                inProgress={!justFinished && currentIsStation}
                size={44}
              />
            </div>
            <p className="live-session-tracker__segment-name">
              {justFinished ? "" : "Currently on"}
            </p>
            <h1 className="live-session-tracker__segment-title">
              {justFinished ? "Nice work." : (currentSegment?.label ?? "")}
            </h1>
            <p className="live-session-tracker__timer">
              {formatSegmentTime(elapsedOnCurrent)}
            </p>
            <p className="live-session-tracker__timer-label">
              Elapsed on this segment
            </p>
          </div>

          <div className="live-session-tracker__bottom">
            <button
              type="button"
              className="live-session-tracker__drawer-handle"
              onClick={() => setSplitsOpen(true)}
              aria-expanded={splitsOpen}
              disabled={draft.segments.length === 0}
            >
              <span className="live-session-tracker__grabber" aria-hidden="true" />
              <span>Splits</span>
            </button>

            <button
              type="button"
              className="live-session-tracker__tap"
              onClick={handleTap}
              disabled={justFinished || !currentSegment}
            >
              <span className="live-session-tracker__tap-label">TAP TO LAP</span>
            </button>

            <button
              type="button"
              className="live-session-tracker__undo"
              onClick={handleUndo}
              disabled={draft.segments.length === 0 || justFinished}
            >
              Undo last lap
            </button>
          </div>
        </>
      )}

      {splitsOpen ? (
        <div
          className="live-session-tracker__drawer"
          role="dialog"
          aria-label="Splits so far"
        >
          <button
            type="button"
            className="live-session-tracker__drawer-close"
            onClick={() => setSplitsOpen(false)}
            aria-label="Close splits"
          >
            <span className="live-session-tracker__grabber" aria-hidden="true" />
          </button>
          <p className="live-session-tracker__drawer-title">Splits so far</p>
          <div className="live-session-tracker__split-rows">
            {draft.segments.map((segment, index) => (
              <div
                className="live-session-tracker__split-row"
                key={`${segment.key}-${index}`}
              >
                <span>{sequence[index]?.label ?? segment.key}</span>
                <span>{formatSegmentTime(segment.seconds)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Replace `styles/_live-session.scss` in full**

Replace the entire contents of `styles/_live-session.scss`:

```scss
// Styles for the dedicated live tap-to-lap session pages (setup + tracker).
// Deliberately dark-only, hardcoded (not var(--panel)/var(--ink)/etc.) —
// per docs/superpowers/specs/2026-08-24-live-logger-dedicated-page-design.md's
// "Theming" section, this screen always renders dark regardless of the
// user's light/dark preference, matching Strava's own recording screen
// (dark for outdoor visibility/battery, not reactive to system theme).
// These values match the app's real dark-theme tokens (styles/_base.scss)
// but are literal here since var(--panel) etc. would flip in light mode.

$live-panel: #0e1914;
$live-ink: #f4f7ef;
$live-muted: #adbaaa;
$live-line: #284237;
$live-lime: #c8ff2e;
$live-action-text: #10130f;

.live-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: $live-panel;
  color: $live-ink;
}

.live-page__topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: max(20px, env(safe-area-inset-top, 0px)) 20px 0;
}

.live-page__exit {
  width: 34px;
  height: 34px;
  min-height: 0;
  margin: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: $live-muted;
  font-size: 1.1rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.live-page__topbar-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: $live-muted;
}

.live-page__topbar-spacer {
  width: 34px;
}

// ── Setup screen ──

.live-session-setup {
  flex: 1;
  max-width: 30rem;
  width: 100%;
  margin: 0 auto;
  padding: 28px 24px 34px;
  display: flex;
  flex-direction: column;
}

.live-session-setup__eyebrow {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: $live-lime;
  margin: 8px 0 10px;
}

.live-session-setup__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 2rem;
  line-height: 1.05;
  margin: 0 0 14px;
  letter-spacing: -0.01em;
}

.live-session-setup__guide {
  color: $live-muted;
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0 0 26px;
}

.live-session-setup__field-label {
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: $live-muted;
  margin: 0 0 10px;
}

.live-session-setup__format-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 26px;
}

.live-session-setup__format-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid $live-line;
  border-radius: 12px;
  padding: 14px 16px;
  background: transparent;
  color: $live-ink;
  min-height: 0;
}

.live-session-setup__format-card.is-active {
  border-color: $live-lime;
  background: rgba(200, 255, 46, 0.06);
}

.live-session-setup__format-name {
  font-weight: 700;
  font-size: 0.92rem;
}

.live-session-setup__format-sub {
  color: $live-muted;
  font-size: 0.78rem;
}

.live-session-setup__row {
  display: flex;
  gap: 12px;
  margin-bottom: 30px;
}

.live-session-setup__start {
  margin-top: auto;
  width: 100%;
  padding: 18px;
  border: none;
  border-radius: 16px;
  background: $live-lime;
  color: $live-action-text;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
  min-height: 0;
}

// ── Tracker screen ──

.live-session-tracker__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 24px 0;
}

.live-session-tracker__badge {
  margin-bottom: 12px;
}

.live-session-tracker__segment-name {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: $live-muted;
  margin: 0 0 6px;
  min-height: 1em;
}

.live-session-tracker__segment-title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.5rem;
  margin: 0 0 22px;
}

.live-session-tracker__timer {
  font-family: var(--font-mono);
  font-weight: 800;
  font-size: 4.4rem;
  line-height: 0.9;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: $live-ink;
  margin: 0 0 6px;
}

.live-session-tracker__timer-label {
  font-family: var(--font-mono);
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #5c6655;
  margin: 0 0 30px;
}

.live-session-tracker__bottom {
  margin-top: auto;
  padding: 0 24px max(24px, env(safe-area-inset-bottom, 0px));
}

.live-session-tracker__drawer-handle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 0;
  margin: 0 0 14px;
  border: none;
  background: transparent;
  color: #5c6655;
}

.live-session-tracker__drawer-handle:disabled {
  opacity: 0.4;
}

.live-session-tracker__drawer-handle span:last-child {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.live-session-tracker__grabber {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: $live-line;
}

.live-session-tracker__tap {
  width: 100%;
  min-height: 92px;
  border-radius: 20px;
  background: $live-lime;
  border: none;
  box-shadow: 0 0 0 8px rgba(200, 255, 46, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 0 14px;
}

.live-session-tracker__tap:disabled {
  opacity: 0.6;
}

.live-session-tracker__tap-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  font-weight: 700;
  color: $live-action-text;
  opacity: 0.75;
}

.live-session-tracker__undo {
  display: block;
  width: 100%;
  min-height: 0;
  margin: 0;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: $live-muted;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  text-align: center;
}

.live-session-tracker__undo:disabled {
  opacity: 0.4;
}

.live-session-tracker__finish-time {
  flex: 1;
  max-width: 28rem;
  width: 100%;
  margin: 0 auto;
  padding: 24px 24px 0;
}

.live-session-tracker__finish-time-hint {
  color: $live-muted;
  font-size: 0.8rem;
  line-height: 1.5;
  margin: 8px 0 24px;
}

.live-session-tracker__continue {
  width: 100%;
  padding: 18px;
  border: none;
  border-radius: 16px;
  background: $live-lime;
  color: $live-action-text;
  font-weight: 700;
  font-size: 0.95rem;
  min-height: 0;
}

// ── Splits drawer ──

.live-session-tracker__drawer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  max-height: 55dvh;
  display: flex;
  flex-direction: column;
  background: #14241d;
  border-top: 1px solid $live-line;
  border-radius: 22px 22px 0 0;
  padding: 14px 22px max(20px, env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -20px 40px rgba(0, 0, 0, 0.35);
}

.live-session-tracker__drawer-close {
  align-self: center;
  min-height: 0;
  margin: 0 0 14px;
  padding: 6px;
  border: none;
  background: transparent;
}

.live-session-tracker__drawer-title {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: $live-muted;
  margin: 0 0 12px;
}

.live-session-tracker__split-rows {
  flex: 1;
  overflow-y: auto;
}

.live-session-tracker__split-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #1c2a21;
  font-size: 0.86rem;
  color: $live-ink;
}

.live-session-tracker__split-row span:last-child {
  font-variant-numeric: tabular-nums;
  color: $live-muted;
}
```

(This file replacement also covers the setup-screen classes referenced by Task 7's rewrite of `LiveSessionSetup.tsx` — `.live-page`, `.live-page__topbar*`, `.live-session-setup*` are all included above. Task 7 doesn't need to touch this file again.)

- [ ] **Step 3: Verify types check**

Run: `npx tsc --noEmit`
Expected: **no errors.** At this point in the plan, nothing calls `<LiveSessionTracker>` at all (Task 3 already deleted the old caller in `app/app/page.tsx`, and Task 7's new caller doesn't exist yet) — an uncalled component with a changed prop type doesn't produce a `tsc` error, it's just unreferenced. Zero errors here is the correct, expected outcome, not something to double-check away.

- [ ] **Step 4: Run lint and the build**

Run: `npm run lint && npm run build`
Expected: no errors. (An unused-export lint warning for `LiveSessionTracker`, if this project's ESLint config flags those, would be expected here and resolves once Task 7 wires it up — don't treat that specific warning as a blocker if it appears.)

- [ ] **Step 5: Commit**

```bash
git add components/LiveSessionTracker.tsx styles/_live-session.scss
git commit -m "Rework LiveSessionTracker into the full-bleed Strava-style recording screen"
```

---

### Task 7: `app/app/live/page.tsx` — the new dedicated route

**Files:**
- Create: `app/app/live/page.tsx`
- Modify: `components/LiveSessionSetup.tsx`

This is the page that makes Task 5's `/app/live` link resolve. It owns the setup↔tracking stage, the resume-on-load check (moved from the old `startLiveSession`), its own minimal `user`/`savedReports` bootstrap (read-only — no login/signup UI, that stays on `/app`), and calls the shared `useReportGeneration` hook from Task 1. This task also rewrites `LiveSessionSetup.tsx` to match the approved mockup's setup screen (its props/behavior contract is unchanged — only its JSX/CSS output changes).

- [ ] **Step 1: Rewrite `components/LiveSessionSetup.tsx`**

Replace the full contents of `components/LiveSessionSetup.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Level, levelLabels } from "@/lib/analysis";
import { LiveSessionFormat } from "@/lib/liveSession";
import { raceFormatOptions } from "@/lib/raceFormats";
import { maskTimeInput, normalizeTimeInput } from "@/lib/validation";

type LiveSessionSetupProps = {
  onStart: (input: { raceFormat: LiveSessionFormat; level: Level; targetTime: string }) => void;
  onCancel: () => void;
};

export function LiveSessionSetup({ onStart, onCancel }: LiveSessionSetupProps) {
  const [raceFormat, setRaceFormat] = useState<LiveSessionFormat>("hyrox");
  const [level, setLevel] = useState<Level>("competitive");
  const [targetTime, setTargetTime] = useState("");

  return (
    <div className="live-page">
      <div className="live-page__topbar">
        <button
          type="button"
          className="live-page__exit"
          onClick={onCancel}
          aria-label="Cancel and go back"
        >
          ‹
        </button>
        <span className="live-page__topbar-label">New session</span>
        <span className="live-page__topbar-spacer" aria-hidden="true" />
      </div>

      <div className="live-session-setup">
        <p className="live-session-setup__eyebrow">HYROX / TRYKA</p>
        <h1 className="live-session-setup__title">
          Start a live
          <br />
          session
        </h1>
        <p className="live-session-setup__guide">
          Lap your watch — or just tap the button on the next screen — after
          every run and every station, 16 taps total. Ready when you are.
        </p>

        <p className="live-session-setup__field-label">Format</p>
        <div className="live-session-setup__format-list">
          {raceFormatOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={
                option.id === raceFormat
                  ? "live-session-setup__format-card is-active"
                  : "live-session-setup__format-card"
              }
              onClick={() => setRaceFormat(option.id as LiveSessionFormat)}
            >
              <span className="live-session-setup__format-name">
                {option.label}
              </span>
              <span className="live-session-setup__format-sub">
                {option.runLabel} · {option.stations.length} rounds
              </span>
            </button>
          ))}
        </div>

        <p className="live-session-setup__field-label">Level &amp; target</p>
        <div className="live-session-setup__row">
          <label className="field">
            <span>Athlete level</span>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value as Level)}
            >
              {Object.entries(levelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Target time (optional)</span>
            <input
              value={targetTime}
              onChange={(event) =>
                setTargetTime(maskTimeInput(event.target.value, "race"))
              }
              onBlur={(event) =>
                setTargetTime(normalizeTimeInput(event.target.value, "race"))
              }
              inputMode="numeric"
              placeholder="1:15:00"
            />
          </label>
        </div>

        <button
          type="button"
          className="live-session-setup__start"
          onClick={() => onStart({ raceFormat, level, targetTime })}
        >
          Start session
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the new page**

Before writing this file, **read `components/ResultsReveal.tsx` and `components/Toast.tsx`** to confirm their exact prop names — this plan's code below assumes `ResultsReveal` takes `analysis`/`isNewPB`/`onClose`/`onViewArchetype` and `Toast` takes `toast`/`onDismiss`, mirroring how `app/app/page.tsx` already renders them (`grep -n "<ResultsReveal\|<Toast" app/app/page.tsx` to see the real usage) — but confirm before treating a mismatch as this plan's error rather than a real one.

Create `app/app/live/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveSessionSetup } from "@/components/LiveSessionSetup";
import { LiveSessionTracker } from "@/components/LiveSessionTracker";
import { ReportGenerationOverlay } from "@/components/ReportGenerationOverlay";
import { ResultsReveal } from "@/components/ResultsReveal";
import {
  LiveSessionDraft,
  LiveSessionFormat,
  clearDraft,
  loadDraft,
} from "@/lib/liveSession";
import { Level } from "@/lib/analysis";
import { getRaceFormatStations } from "@/lib/raceFormats";
import { AuthUser, getCurrentUser } from "@/lib/apiClient";
import { SavedReport, loadRemoteReports, loadSavedReports } from "@/lib/reportStorage";
import { emptyTrainingContext } from "@/lib/trainingContext";
import { Toast, ToastMessage } from "@/components/Toast";
import { useReportGeneration } from "@/lib/hooks/useReportGeneration";

type Stage = "setup" | "tracking";

export default function LiveSessionPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [stage, setStage] = useState<Stage>("setup");
  const [config, setConfig] = useState<{
    raceFormat: LiveSessionFormat;
    level: Level;
    targetTime: string;
  } | null>(null);
  const [draftToResume, setDraftToResume] = useState<LiveSessionDraft | null>(
    null,
  );

  const fullReportUnlocked = user?.subscription === "ACTIVE";

  const {
    generatingReport,
    analysis,
    showResultsReveal,
    setShowResultsReveal,
    revealIsPb,
    generateAndSaveReport,
  } = useReportGeneration({
    user,
    savedReports,
    setSavedReports,
    setToast,
    fullReportUnlocked,
  });

  // Minimal, read-only session bootstrap — same pattern as app/app/page.tsx's
  // own initial-load effect, but without any of that page's login/signup UI
  // or billing-sync polling, since this page never lets someone sign in.
  useEffect(() => {
    let cancelled = false;

    async function loadInitialSession() {
      try {
        const currentUser = await getCurrentUser();

        if (cancelled) {
          return;
        }

        setUser(currentUser);
        setSavedReports(
          currentUser ? await loadRemoteReports() : loadSavedReports(),
        );
      } catch {
        if (!cancelled) {
          setSavedReports(loadSavedReports());
        }
      }
    }

    void loadInitialSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // On load, offer to resume an interrupted session rather than silently
  // discarding it — the same check the old embedded startLiveSession() did,
  // relocated to this page's mount instead of a button click.
  useEffect(() => {
    const existingDraft = loadDraft();

    if (!existingDraft) {
      return;
    }

    const resume = window.confirm(
      "You have an unfinished live session in progress. Resume it? (Cancel starts a new session and discards it.)",
    );

    if (resume) {
      setConfig({
        raceFormat: existingDraft.raceFormat,
        level: existingDraft.level,
        targetTime: existingDraft.targetTime,
      });
      setDraftToResume(existingDraft);
      setStage("tracking");
      return;
    }

    clearDraft();
  }, []);

  return (
    <>
      {stage === "setup" ? (
        <LiveSessionSetup
          onCancel={() => router.push("/app")}
          onStart={(nextConfig) => {
            setConfig(nextConfig);
            setStage("tracking");
          }}
        />
      ) : config ? (
        <LiveSessionTracker
          raceFormat={config.raceFormat}
          level={config.level}
          targetTime={config.targetTime}
          initialDraft={draftToResume ?? undefined}
          onExit={() => router.push("/app")}
          onFinish={({ runs, stationSplits, officialFinishTime }) => {
            const finishedConfig = config;
            void generateAndSaveReport({
              goal: "",
              targetTime: finishedConfig.targetTime,
              level: finishedConfig.level,
              runs,
              stationSplits,
              stationDefinitions: getRaceFormatStations(
                finishedConfig.raceFormat,
              ),
              raceFormat: finishedConfig.raceFormat,
              officialFinishTime,
              trainingContext: emptyTrainingContext,
            });
          }}
        />
      ) : null}

      {generatingReport ? <ReportGenerationOverlay /> : null}
      {showResultsReveal && analysis ? (
        <ResultsReveal
          analysis={analysis}
          isNewPB={revealIsPb}
          onClose={() => {
            setShowResultsReveal(false);
            router.push("/app");
          }}
          onViewArchetype={() => {
            setShowResultsReveal(false);
            router.push("/app?tab=new");
          }}
        />
      ) : null}
      {toast ? <Toast toast={toast} onDismiss={() => setToast(null)} /> : null}
    </>
  );
}
```

If Step 2's read of `ResultsReveal.tsx`/`Toast.tsx` found different prop names than assumed above, adjust this file's JSX to match exactly — don't guess.

- [ ] **Step 3: Verify types check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. This should also resolve any "unused/uncalled" noise `tsc` reported at the end of Task 6, since `LiveSessionTracker` is now actually used with the `onExit` prop it expects.

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, navigate to `/app/live` directly (or via the nav's Record button from Task 5).

- Confirm the setup screen matches the approved mockup: minimal top bar, title, guide copy, format list, level/target fields, full-width Start button pinned to the bottom.
- Confirm "Start session" moves into tracking, and the tracking screen shows the minimal top bar with segment counter, octagon badge + "Currently on" + segment name + huge timer as the dominant hero stat, "TAP TO LAP" button at the bottom (no timer inside it now), Undo below it, a "Splits" drawer-handle above the tap button.
- Tap through several segments — confirm the timer resets and counts for each new segment, the octagon fills in, the header's counter updates.
- Tap "Splits" — confirm the drawer slides up showing completed segments, disabled/inert before any exist.
- Complete all 16 taps (with and without an official finish time, across two separate sessions) — confirm the finish beat then finish-time screen, then generation → reveal → dismissing navigates back to `/app` with the new report visible, matching the old embedded flow's output exactly.
- Confirm the exit control works from both setup and tracking, and that exiting mid-session preserves the draft (start a session, tap a few laps, exit, click Record again from `/app` — should prompt to resume, and resuming should restore progress and the live-ticking timer).

Stop the dev server after checking.

- [ ] **Step 5: Commit**

```bash
git add app/app/live/page.tsx components/LiveSessionSetup.tsx
git commit -m "Add the dedicated /app/live route"
```

---

### Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, no regressions (this plan adds no new automated tests — `useReportGeneration` is a stateful hook with no jsdom/testing-library in this project to render it, and the visual rework is presentational — both verified by eye per this codebase's established convention).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds, no SCSS/type errors, `/app/live` appears in the route list.

- [ ] **Step 3: Manual browser pass — full end-to-end**

Run: `npm run dev`, then in a browser:

1. From `/app`, click the nav's Record button (both at desktop width and at mobile width) — confirm it navigates to `/app/live`.
2. Complete a full live session end to end (HYROX and one TRYKA format), confirm the resulting report is correct and identical in content to what the old embedded flow produced.
3. Confirm official-finish-time (roxzone) still works: entering a time produces a roxzone tax in the report, leaving it blank doesn't.
4. Confirm undo works correctly on the new tracker layout.
5. Interrupt a session (start, tap a few laps, exit via the top-bar control or close the tab), return via the nav's Record button — confirm the resume prompt appears and correctly restores progress and the live timer.
6. Confirm manual entry (`SplitForm`'s own submit) still works exactly as before — the regression check for Tasks 1-2's hook extraction.
7. Confirm the nav: no "Log live" button in `SplitForm`'s preset actions anymore; the Record button is the only entry point; Events is gone from the mobile bottom bar but still reachable from the header on both mobile and desktop widths.
8. Confirm theme behavior: the nav (part of the regular app shell) respects light/dark theme correctly in both states; `/app/live` itself stays dark regardless of the theme setting (this is the deliberate, spec'd behavior — not a bug).
9. Confirm `prefers-reduced-motion: reduce` disables the Record button's ring pulse.

Stop the dev server when done.

- [ ] **Step 4: Confirm no leftover temp files**

Run: `git status`
Expected: clean working tree.

---

## Summary of new/changed files

**New:**
- `lib/hooks/useReportGeneration.ts`
- `components/RecordBadge.tsx`
- `styles/_record-badge.scss`
- `app/app/live/page.tsx`

**Modified:**
- `app/app/page.tsx` (hook wiring, embedded live-session flow removed, tab-bar restyled)
- `components/SplitForm.tsx` ("Log live" button + prop removed)
- `components/LiveSessionSetup.tsx` (visual rework)
- `components/LiveSessionTracker.tsx` (visual rework, new `onExit` prop)
- `styles/_layout.scss` (tab-bar full rework, both breakpoints)
- `styles/_live-session.scss` (full rewrite for the new layout)
- `app/globals.scss` (new `@use` for `_record-badge.scss`)
