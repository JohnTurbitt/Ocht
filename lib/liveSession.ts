import { Level, StationKey, formatTime } from "./analysis";
import { RaceFormat, getRaceFormatOption } from "./raceFormats";

// The live logger only supports fixed formats with a real, known station
// sequence — "custom" races have no fixed sequence a tap-to-lap flow could
// follow, so it's excluded at the type level (same pattern already used by
// PacingCalculator's format picker and lib/pacingPredictor.ts's runtime guard).
export type LiveSessionFormat = Exclude<RaceFormat, "custom">;

export type LiveSessionSegment = {
  type: "run" | "station";
  key: string;
  seconds: number;
};

export type LiveSessionDraft = {
  raceFormat: LiveSessionFormat;
  level: Level;
  targetTime: string;
  startedAt: string;
  segments: LiveSessionSegment[];
};

export type SegmentDescriptor = {
  type: "run" | "station";
  key: string;
  label: string;
};

const RUN_LEG_COUNT = 8;
const DRAFT_STORAGE_KEY = "ocht.liveSession.draft";

export function buildSegmentSequence(
  raceFormat: LiveSessionFormat,
): SegmentDescriptor[] {
  const format = getRaceFormatOption(raceFormat);
  const sequence: SegmentDescriptor[] = [];

  for (let i = 0; i < RUN_LEG_COUNT; i++) {
    sequence.push({ type: "run", key: `run-${i + 1}`, label: `Run ${i + 1}` });

    const station = format.stations[i];
    if (station) {
      sequence.push({ type: "station", key: station.key, label: station.label });
    }
  }

  return sequence;
}

export function startDraft(
  raceFormat: LiveSessionFormat,
  level: Level,
  targetTime: string,
): LiveSessionDraft {
  return {
    raceFormat,
    level,
    targetTime,
    startedAt: new Date().toISOString(),
    segments: [],
  };
}

export function recordLap(draft: LiveSessionDraft, seconds: number): LiveSessionDraft {
  const sequence = buildSegmentSequence(draft.raceFormat);
  const next = sequence[draft.segments.length];

  if (!next) {
    return draft;
  }

  return {
    ...draft,
    segments: [...draft.segments, { type: next.type, key: next.key, seconds }],
  };
}

export function undoLastLap(draft: LiveSessionDraft): LiveSessionDraft {
  return { ...draft, segments: draft.segments.slice(0, -1) };
}

export function isSessionComplete(draft: LiveSessionDraft): boolean {
  return draft.segments.length >= buildSegmentSequence(draft.raceFormat).length;
}

export function draftToReportInputs(draft: LiveSessionDraft): {
  runs: string[];
  stationSplits: Record<StationKey, string>;
} {
  const runs: string[] = [];
  const stationSplits: Record<StationKey, string> = {};

  for (const segment of draft.segments) {
    if (segment.type === "run") {
      runs.push(formatTime(segment.seconds));
    } else {
      stationSplits[segment.key] = formatTime(segment.seconds);
    }
  }

  return { runs, stationSplits };
}

export function saveDraft(draft: LiveSessionDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function loadDraft(): LiveSessionDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as LiveSessionDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(DRAFT_STORAGE_KEY);
}
