import { Analysis, formatTime } from "./analysis";

export type TrainingTrend = "building" | "stable" | "dropping";

export type TrainingContext = {
  runsPerWeek: string;
  weeklyDistanceKm: string;
  longestRunKm: string;
  hardRunsPerWeek: string;
  compromisedRunsPerWeek: string;
  strengthSessionsPerWeek: string;
  restDaysPerWeek: string;
  recentTrend: TrainingTrend;
};

export type RunningDiagnosis = {
  title: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  metrics: RunningMetric[];
  evidence: string[];
  weeklyFocus: string[];
};

type RunningMetric = {
  label: string;
  value: string;
  detail: string;
  status: "good" | "watch" | "risk";
};

export const emptyTrainingContext: TrainingContext = {
  runsPerWeek: "",
  weeklyDistanceKm: "",
  longestRunKm: "",
  hardRunsPerWeek: "",
  compromisedRunsPerWeek: "",
  strengthSessionsPerWeek: "",
  restDaysPerWeek: "",
  recentTrend: "stable",
};

export function hasTrainingContext(context: TrainingContext) {
  return [
    context.runsPerWeek,
    context.weeklyDistanceKm,
    context.longestRunKm,
    context.hardRunsPerWeek,
    context.compromisedRunsPerWeek,
    context.strengthSessionsPerWeek,
    context.restDaysPerWeek,
  ].some((value) => value.trim().length > 0);
}

export function sanitizeTrainingContext(value: unknown): TrainingContext | undefined {
  if (typeof value !== "object" || !value) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const recentTrend =
    record.recentTrend === "building" ||
    record.recentTrend === "stable" ||
    record.recentTrend === "dropping"
      ? record.recentTrend
      : "stable";

  return {
    runsPerWeek: readContextString(record.runsPerWeek),
    weeklyDistanceKm: readContextString(record.weeklyDistanceKm),
    longestRunKm: readContextString(record.longestRunKm),
    hardRunsPerWeek: readContextString(record.hardRunsPerWeek),
    compromisedRunsPerWeek: readContextString(record.compromisedRunsPerWeek),
    strengthSessionsPerWeek: readContextString(record.strengthSessionsPerWeek),
    restDaysPerWeek: readContextString(record.restDaysPerWeek),
    recentTrend,
  };
}

export function buildRunningDiagnosis(
  analysis: Analysis,
  context: TrainingContext,
): RunningDiagnosis | null {
  if (!hasTrainingContext(context)) {
    return null;
  }

  const runsPerWeek = readNumber(context.runsPerWeek);
  const weeklyDistanceKm = readNumber(context.weeklyDistanceKm);
  const longestRunKm = readNumber(context.longestRunKm);
  const hardRunsPerWeek = readNumber(context.hardRunsPerWeek);
  const compromisedRunsPerWeek = readNumber(context.compromisedRunsPerWeek);
  const strengthSessionsPerWeek = readNumber(context.strengthSessionsPerWeek);
  const restDaysPerWeek = readNumber(context.restDaysPerWeek);
  const runFrequencyStatus = getRunFrequencyStatus(runsPerWeek);
  const volumeStatus = getVolumeStatus(weeklyDistanceKm);
  const longRunStatus = getLongRunStatus(longestRunKm, analysis.raceFormat);
  const durabilityStatus = compromisedRunsPerWeek >= 1 ? "good" : "watch";
  const recoveryStatus =
    hardRunsPerWeek + strengthSessionsPerWeek >= 5 ||
    (restDaysPerWeek > 0 && restDaysPerWeek < 1.5)
      ? "risk"
      : "good";
  const confidence = getConfidence(context);
  const metrics: RunningMetric[] = [
    {
      label: "Run base",
      value:
        runsPerWeek || weeklyDistanceKm
          ? `${runsPerWeek || 0} runs / ${weeklyDistanceKm || 0}km`
          : "Not logged",
      detail: describeRunBase(runsPerWeek, weeklyDistanceKm),
      status: worseStatus(runFrequencyStatus, volumeStatus),
    },
    {
      label: "Long run",
      value: longestRunKm ? `${longestRunKm}km` : "Not logged",
      detail: describeLongRun(longestRunKm, analysis.raceFormat),
      status: longRunStatus,
    },
    {
      label: "Hybrid exposure",
      value: `${compromisedRunsPerWeek || 0}/week`,
      detail:
        compromisedRunsPerWeek >= 1
          ? "Running after station stress is present."
          : "No compromised running signal logged.",
      status: durabilityStatus,
    },
    {
      label: "Recovery pressure",
      value: `${hardRunsPerWeek + strengthSessionsPerWeek}/week`,
      detail:
        recoveryStatus === "risk"
          ? "Hard run plus strength load may be crowding recovery."
          : "Hard work and recovery look workable.",
      status: recoveryStatus,
    },
    {
      label: "Race fade",
      value: formatTime(analysis.runFadeSeconds),
      detail:
        analysis.runFadeSeconds >= 12
          ? "Late race running is fading enough to train directly."
          : "Second-half run fade is controlled.",
      status: analysis.runFadeSeconds >= 18 ? "risk" : analysis.runFadeSeconds >= 12 ? "watch" : "good",
    },
  ];
  const hasRunFade = analysis.runFadeSeconds >= 12;
  const hasVolatilePacing = analysis.runVolatilitySeconds >= 18;
  const lowVolume = runsPerWeek > 0 && runsPerWeek < 3;
  const lowDistance = weeklyDistanceKm > 0 && weeklyDistanceKm < 20;
  const lowCompromisedWork = compromisedRunsPerWeek < 1;
  const highLoad =
    hardRunsPerWeek + strengthSessionsPerWeek >= 5 ||
    (restDaysPerWeek > 0 && restDaysPerWeek < 1.5);

  if (highLoad && context.recentTrend === "building") {
    return {
      title: "Recovery risk",
      confidence,
      summary:
        "Your training input suggests load is building quickly, so the fastest improvement may come from protecting quality rather than adding more work.",
      metrics,
      evidence: [
        `${hardRunsPerWeek + strengthSessionsPerWeek} hard or strength sessions per week.`,
        `${restDaysPerWeek || 0} rest days per week logged.`,
        `Current race gap is ${formatTime(analysis.targetGapSeconds)}.`,
      ],
      weeklyFocus: [
        "Keep one quality run, one compromised session, and remove any extra hard volume.",
        "Use easy aerobic work to support recovery instead of chasing every split.",
        "Retest the race file after a fresher week before increasing load again.",
      ],
    };
  }

  if ((lowVolume || lowDistance) && analysis.targetGapSeconds > 0) {
    return {
      title: "Aerobic base limiter",
      confidence,
      summary:
        "The race file has time to find, and the recent running base looks light. Build repeatable volume before adding more hard race simulation.",
      metrics,
      evidence: [
        `${runsPerWeek || 0} runs per week and ${weeklyDistanceKm || 0}km weekly distance.`,
        `Longest recent run is ${longestRunKm || 0}km.`,
        `Target gap is ${formatTime(analysis.targetGapSeconds)}.`,
      ],
      weeklyFocus: [
        "Run 3 times this week before increasing intensity.",
        "Keep two runs easy enough to finish with control.",
        "Add one short station-to-run transition only if the easy volume feels repeatable.",
      ],
    };
  }

  if (hasRunFade && lowCompromisedWork) {
    return {
      title: "Compromised durability",
      confidence,
      summary:
        "Your race splits fade late, but the context does not show enough running after station stress.",
      metrics,
      evidence: [
        `Second-half run fade is ${formatTime(analysis.runFadeSeconds)} per run on average.`,
        `${compromisedRunsPerWeek || 0} compromised runs per week logged.`,
        `Average run pace in the report is ${analysis.averageRunPace}.`,
      ],
      weeklyFocus: [
        "Keep two easy aerobic runs in the week.",
        "Add one compromised run session after controlled station work.",
        "Do not make the compromised session a max effort; the goal is repeatable late-race rhythm.",
      ],
    };
  }

  if (hasVolatilePacing) {
    return {
      title: "Pacing control",
      confidence,
      summary:
        "The run profile is uneven. You may gain more from controlling early pace than adding harder sessions.",
      metrics,
      evidence: [
        `Run split variation is ${formatTime(analysis.runVolatilitySeconds)}.`,
        `The target requires ${formatTime(analysis.requiredGainPerRunSeconds)} per run if solved through running.`,
        `Recent trend is ${context.recentTrend}.`,
      ],
      weeklyFocus: [
        "Run one session as even 1km repeats with a strict first-rep ceiling.",
        "Keep easy runs genuinely easy so pacing control is not hidden by fatigue.",
        "Retest with a deliberate first-half pace cap.",
      ],
    };
  }

  if (hardRunsPerWeek < 1 && runsPerWeek >= 3 && weeklyDistanceKm >= 20) {
    return {
      title: "Threshold development",
      confidence,
      summary:
        "The base looks usable, but there is little hard running exposure. Add one controlled threshold stimulus before chasing more station fatigue.",
      metrics,
      evidence: [
        `${runsPerWeek} runs and ${weeklyDistanceKm}km per week logged.`,
        `${hardRunsPerWeek || 0} hard runs per week logged.`,
        `Current average run pace is ${analysis.averageRunPace}.`,
      ],
      weeklyFocus: [
        "Keep two easy runs.",
        "Add one threshold interval session at controlled effort.",
        "Use station work as maintenance until the run pace trend moves.",
      ],
    };
  }

  return {
    title: "Station-first focus",
    confidence,
    summary:
      "The running context looks stable enough that the next gain is more likely in station execution, transitions, or race-specific fatigue.",
    metrics,
    evidence: [
      `${runsPerWeek || 0} runs per week and ${weeklyDistanceKm || 0}km weekly distance.`,
      `${compromisedRunsPerWeek || 0} compromised runs per week logged.`,
      `Top race leak is ${analysis.topLeaks[0]?.label ?? "not clear"}.`,
    ],
    weeklyFocus: [
      "Maintain current easy running frequency.",
      "Use one session to rehearse the top station leak under fatigue.",
      "Retest the race file after station-specific work instead of adding random run volume.",
    ],
  };
}

function readContextString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 20) : "";
}

function readNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getConfidence(context: TrainingContext): RunningDiagnosis["confidence"] {
  const fields = [
    context.runsPerWeek,
    context.weeklyDistanceKm,
    context.longestRunKm,
    context.hardRunsPerWeek,
    context.compromisedRunsPerWeek,
    context.strengthSessionsPerWeek,
    context.restDaysPerWeek,
  ].filter((value) => value.trim().length > 0).length;

  if (fields >= 6) {
    return "high";
  }

  if (fields >= 3) {
    return "medium";
  }

  return "low";
}

function getRunFrequencyStatus(runsPerWeek: number) {
  if (runsPerWeek >= 3) {
    return "good" as const;
  }

  if (runsPerWeek >= 2) {
    return "watch" as const;
  }

  return "risk" as const;
}

function getVolumeStatus(weeklyDistanceKm: number) {
  if (weeklyDistanceKm >= 30) {
    return "good" as const;
  }

  if (weeklyDistanceKm >= 20) {
    return "watch" as const;
  }

  return "risk" as const;
}

function getLongRunStatus(longestRunKm: number, raceFormat: Analysis["raceFormat"]) {
  const target = raceFormat === "tryka500" ? 6 : raceFormat === "tryka800" ? 8 : 10;

  if (longestRunKm >= target) {
    return "good" as const;
  }

  if (longestRunKm >= target * 0.7) {
    return "watch" as const;
  }

  return "risk" as const;
}

function worseStatus(
  first: "good" | "watch" | "risk",
  second: "good" | "watch" | "risk",
) {
  if (first === "risk" || second === "risk") {
    return "risk";
  }

  if (first === "watch" || second === "watch") {
    return "watch";
  }

  return "good";
}

function describeRunBase(runsPerWeek: number, weeklyDistanceKm: number) {
  if (runsPerWeek >= 3 && weeklyDistanceKm >= 30) {
    return "Enough base to make race-specific work useful.";
  }

  if (runsPerWeek >= 3 || weeklyDistanceKm >= 20) {
    return "Usable base, but keep progression controlled.";
  }

  return "Base looks light for aggressive race improvement.";
}

function describeLongRun(longestRunKm: number, raceFormat: Analysis["raceFormat"]) {
  const target = raceFormat === "tryka500" ? 6 : raceFormat === "tryka800" ? 8 : 10;

  if (longestRunKm >= target) {
    return "Long run support is in place for this format.";
  }

  return `Aim to build toward a repeatable ${target}km run.`;
}
