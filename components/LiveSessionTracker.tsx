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
    <div className="live-session-tracker">
      <div className="live-session-tracker__header">
        <StationProgressOctagon
          doneCount={justFinished ? 8 : doneStationCount}
          inProgress={!justFinished && currentIsStation}
        />
        <div>
          <p className="live-session-tracker__status">
            {justFinished
              ? "FINISHED"
              : `STATION ${Math.min(doneStationCount + (currentIsStation ? 1 : 0), 8)} OF 8 · SEGMENT ${currentIndex + 1}/16`}
          </p>
          <h1>{justFinished ? "Nice work." : (currentSegment?.label ?? "")}</h1>
        </div>
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
            className="btn btn--primary btn--lg"
            onClick={handleFinishTimeSubmit}
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="live-session-tracker__tap"
            onClick={handleTap}
            disabled={justFinished || !currentSegment}
          >
            <span className="live-session-tracker__timer">{formatSegmentTime(elapsedOnCurrent)}</span>
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
        </>
      )}

      <div className="live-session-tracker__splits">
        <p className="live-session-tracker__splits-heading">Splits so far</p>
        {draft.segments.map((segment, index) => (
          <div className="live-session-tracker__split-row" key={`${segment.key}-${index}`}>
            <span>{sequence[index]?.label ?? segment.key}</span>
            <span>{formatSegmentTime(segment.seconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
