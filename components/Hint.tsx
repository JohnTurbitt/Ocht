export type HintKey =
  | "benchmark"
  | "compromisedRun"
  | "gain"
  | "recoverable"
  | "runFade"
  | "targetGap"
  | "timeLeak"
  | "transition";

const hints: Record<HintKey, string> = {
  benchmark:
    "A comparison time for your selected athlete level. Faster than the benchmark means this area is already strong.",
  compromisedRun:
    "A run done straight after station or strength work, such as sled work, rowing, carries, lunges, wall balls, or a station circuit.",
  gain: "The amount of time you could save if this part of the race improves.",
  recoverable:
    "A realistic slice of lost time that may be possible to win back with focused training.",
  runFade:
    "How much slower your final four run splits are compared with your first four.",
  targetGap: "The time between your projected finish and your target finish.",
  timeLeak: "A part of the race where the model thinks time is being lost.",
  transition:
    "Time saved between stations and runs through cleaner exits, setup, and movement.",
};

type HintProps = {
  term: string;
  hint: HintKey;
  enabled: boolean;
};

export function Hint({ term, hint, enabled }: HintProps) {
  if (!enabled) {
    return <>{term}</>;
  }

  return (
    <span className="hint" tabIndex={0}>
      <span className="hint__term">{term}</span>
      <span className="hint__bubble" role="tooltip">
        {hints[hint]}
      </span>
    </span>
  );
}
