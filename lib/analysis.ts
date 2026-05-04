import type { RaceFormat } from "./raceFormats";

export type Level = "starter" | "competitive" | "elite";

export type StationKey = string;

export type Station = {
  key: StationKey;
  label: string;
  benchmarkSec: Record<Level, number>;
  recoverability: number;
  raceImpact: number;
  guidance: string;
};

export type Leak = {
  id: string;
  label: string;
  type: "station" | "run" | "pacing";
  leakSeconds: number;
  recoverableSeconds: number;
  score: number;
  detail: string;
  recommendation: string;
};

export type StationResult = Station & {
  seconds: number;
  benchmark: number;
  gap: number;
  recoverableSeconds: number;
  score: number;
};

export type TrainingWeek = {
  week: number;
  focus: string;
  sessions: string[];
  target: string;
};

export type Analysis = {
  raceFormat: RaceFormat;
  stationDefinitions: Station[];
  level: Level;
  levelLabel: string;
  finishSeconds: number;
  targetSeconds: number;
  targetGapSeconds: number;
  totalRunSeconds: number;
  totalStationSeconds: number;
  averageRunSeconds: number;
  averageRunPace: string;
  firstHalfRunAvg: number;
  secondHalfRunAvg: number;
  runFadeSeconds: number;
  runVolatilitySeconds: number;
  predictedTargetSeconds: number;
  recoverableSeconds: number;
  topLeaks: Leak[];
  stationResults: StationResult[];
  stationBenchmarkSummary: string;
  priorities: string[];
  trainingPlan: TrainingWeek[];
  report: string;
};

export const levelLabels: Record<Level, string> = {
  starter: "Starter",
  competitive: "Competitive",
  elite: "Elite",
};

export const stations: Station[] = [
  {
    key: "ski",
    label: "SkiErg",
    benchmarkSec: { starter: 300, competitive: 255, elite: 225 },
    recoverability: 0.38,
    raceImpact: 0.8,
    guidance:
      "Train controlled pulls after running so the first station does not spike the heart rate.",
  },
  {
    key: "sledPush",
    label: "Sled push",
    benchmarkSec: { starter: 360, competitive: 285, elite: 240 },
    recoverability: 0.58,
    raceImpact: 1,
    guidance:
      "Use heavy pushes for strength and race-weight pushes for foot speed under fatigue.",
  },
  {
    key: "sledPull",
    label: "Sled pull",
    benchmarkSec: { starter: 375, competitive: 300, elite: 255 },
    recoverability: 0.6,
    raceImpact: 0.96,
    guidance:
      "Practise rope rhythm, foot bracing, and short rests before adding more load.",
  },
  {
    key: "burpees",
    label: "Burpee broad jumps",
    benchmarkSec: { starter: 420, competitive: 330, elite: 285 },
    recoverability: 0.62,
    raceImpact: 0.9,
    guidance:
      "Build repeatable jump distance and breathing control instead of sprinting the first half.",
  },
  {
    key: "row",
    label: "Row",
    benchmarkSec: { starter: 315, competitive: 260, elite: 235 },
    recoverability: 0.34,
    raceImpact: 0.72,
    guidance:
      "Hold a sustainable split and exit ready to run, not with a maxed-out pull rate.",
  },
  {
    key: "farmers",
    label: "Farmers carry",
    benchmarkSec: { starter: 270, competitive: 210, elite: 180 },
    recoverability: 0.54,
    raceImpact: 0.74,
    guidance: "Prioritise grip endurance, fast turns, and clean pick-ups.",
  },
  {
    key: "lunges",
    label: "Sandbag lunges",
    benchmarkSec: { starter: 390, competitive: 300, elite: 255 },
    recoverability: 0.66,
    raceImpact: 0.94,
    guidance:
      "Use steady unbroken chunks and practise standing tall under quad fatigue.",
  },
  {
    key: "wallBalls",
    label: "Wall balls",
    benchmarkSec: { starter: 450, competitive: 360, elite: 300 },
    recoverability: 0.72,
    raceImpact: 1,
    guidance:
      "Break sets before failure and train quality reps after compromised running.",
  },
];

export const initialRuns: string[] = Array.from({ length: 8 }, (_, index) =>
  index < 4 ? "5:15" : "5:35",
);

export const initialStations: Record<StationKey, string> = {
  ski: "4:35",
  sledPush: "5:20",
  sledPull: "5:50",
  burpees: "6:10",
  row: "4:45",
  farmers: "3:40",
  lunges: "5:35",
  wallBalls: "6:50",
};

export function parseTime(value: string) {
  const parts = value.trim().split(":").map(Number);

  if (parts.some(Number.isNaN)) {
    return 0;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  return parts[0] || 0;
}

export function formatTime(totalSeconds: number) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));

  return Math.sqrt(variance);
}

function buildStationLeak(result: StationResult): Leak {
  return {
    id: result.key,
    label: result.label,
    type: "station",
    leakSeconds: result.gap,
    recoverableSeconds: result.recoverableSeconds,
    score: result.score,
    detail: `${formatTime(result.seconds)} vs ${formatTime(result.benchmark)} benchmark`,
    recommendation: result.guidance,
  };
}

function buildTrainingPlan(topLeaks: Leak[], predictedTargetSeconds: number) {
  const primaryLeak = topLeaks[0];
  const secondaryLeak = topLeaks[1] ?? primaryLeak;
  const tertiaryLeak = topLeaks[2] ?? secondaryLeak;

  if (!primaryLeak) {
    return [
      {
        week: 1,
        focus: "Baseline pacing",
        sessions: [
          "Complete one controlled race rehearsal at current split targets.",
          "Run 6 x 1km with equal pacing and full note-taking after each rep.",
        ],
        target: "Confirm the split data before increasing training stress.",
      },
      {
        week: 2,
        focus: "Run economy",
        sessions: [
          "Add one aerobic run with relaxed strides after the main work.",
          "Practise station exits into 400m controlled runs.",
        ],
        target: "Keep late-run pace within 10 seconds of early-run pace.",
      },
      {
        week: 3,
        focus: "Station rhythm",
        sessions: [
          "Run station technique work at repeatable race effort.",
          "Use short rest intervals to preserve form under fatigue.",
        ],
        target: "Record clean reps and consistent transitions.",
      },
      {
        week: 4,
        focus: "Race rehearsal",
        sessions: [
          "Complete a reduced-volume simulation with planned split ceilings.",
          "Taper intensity after the rehearsal and keep only light sharpness work.",
        ],
        target: `Rehearse a realistic next finish around ${formatTime(predictedTargetSeconds)}.`,
      },
    ];
  }

  return [
    {
      week: 1,
      focus: `${primaryLeak.label} control`,
      sessions: [
        primaryLeak.recommendation,
        "Add one low-risk technique session and stop each set before form breaks.",
      ],
      target: `Make ${formatTime(primaryLeak.recoverableSeconds)} feel repeatable before chasing more speed.`,
    },
    {
      week: 2,
      focus: `${secondaryLeak.label} under fatigue`,
      sessions: [
        secondaryLeak.recommendation,
        "Pair the focus area with 600m-1km runs at controlled race effort.",
      ],
      target: `Bring the second leak within ${formatTime(Math.max(15, secondaryLeak.recoverableSeconds * 0.6))} of benchmark pace.`,
    },
    {
      week: 3,
      focus: `${tertiaryLeak.label} plus transitions`,
      sessions: [
        tertiaryLeak.recommendation,
        "Practise entering and leaving stations without standing recovery.",
      ],
      target: "Hold planned movement quality while trimming avoidable dead time.",
    },
    {
      week: 4,
      focus: "Race-specific consolidation",
      sessions: [
        "Run a 70-80% volume rehearsal using the planned first-half run ceiling.",
        "Keep the final hard session short, then taper into fresh race-pace touches.",
      ],
      target: `Validate a next target near ${formatTime(predictedTargetSeconds)}.`,
    },
  ];
}

export function buildAnalysis(
  goal: string,
  targetTime: string,
  level: Level,
  runs: string[],
  stationSplits: Record<StationKey, string>,
  stationDefinitions: Station[] = stations,
  raceFormat: RaceFormat = "hyrox",
): Analysis {
  const runSeconds = runs.map(parseTime);
  const totalRunSeconds = runSeconds.reduce((total, split) => total + split, 0);
  const totalValidRuns = runSeconds.filter((split) => split > 0).length || 8;
  const averageRunSeconds = totalRunSeconds / totalValidRuns;
  const firstHalfRunAvg = average(runSeconds.slice(0, 4));
  const secondHalfRunAvg = average(runSeconds.slice(4));
  const runFadeSeconds = Math.max(0, secondHalfRunAvg - firstHalfRunAvg);
  const runVolatilitySeconds = standardDeviation(runSeconds);

  const stationResults = stationDefinitions
    .map((station) => {
      const seconds = parseTime(stationSplits[station.key]);
      const benchmark = station.benchmarkSec[level];
      const gap = Math.max(0, seconds - benchmark);
      const confidence = seconds > 0 ? 1 : 0;
      const recoverableSeconds = Math.round(gap * station.recoverability);
      const score = Math.round(
        gap * station.recoverability * station.raceImpact * confidence,
      );

      return {
        ...station,
        seconds,
        benchmark,
        gap,
        recoverableSeconds,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
  const stationBenchmarkSummary = `Station leaks are measured against ${levelLabels[level]} benchmarks. Run fade and pacing volatility are calculated from your own run splits.`;

  const totalStationSeconds = stationResults.reduce(
    (total, station) => total + station.seconds,
    0,
  );
  const finishSeconds = totalRunSeconds + totalStationSeconds;
  const targetSeconds = parseTime(targetTime);
  const targetGapSeconds = Math.max(0, finishSeconds - targetSeconds);

  const runFadeLeak: Leak = {
    id: "run-fade",
    label: "Second-half run fade",
    type: "run",
    leakSeconds: Math.round(runFadeSeconds * 4),
    recoverableSeconds: Math.round(runFadeSeconds * 4 * 0.55),
    score: Math.round(runFadeSeconds * 4 * 0.55 * 1.08),
    detail: `${formatTime(firstHalfRunAvg)} average for runs 1-4, ${formatTime(secondHalfRunAvg)} for runs 5-8`,
    recommendation:
      "Add one compromised run session each week: station work straight into 600m-1km repeats at controlled race pace.",
  };

  const pacingLeak: Leak = {
    id: "pacing-volatility",
    label: "Pacing volatility",
    type: "pacing",
    leakSeconds: Math.round(runVolatilitySeconds * 3.2),
    recoverableSeconds: Math.round(runVolatilitySeconds * 3.2 * 0.45),
    score: Math.round(runVolatilitySeconds * 3.2 * 0.45 * 0.86),
    detail: `${formatTime(runVolatilitySeconds)} standard deviation across run splits`,
    recommendation:
      "Set a ceiling for the first two runs and practise even kilometre repeats after stations.",
  };

  const leaks = [
    ...stationResults.filter((station) => station.score > 0).map(buildStationLeak),
    ...(runFadeLeak.score > 12 ? [runFadeLeak] : []),
    ...(pacingLeak.score > 10 ? [pacingLeak] : []),
  ].sort((a, b) => b.score - a.score);

  const topLeaks = leaks.slice(0, 3);
  const rawRecoverableSeconds = topLeaks.reduce(
    (total, leak) => total + leak.recoverableSeconds,
    0,
  );
  const recoverableSeconds = Math.round(
    clamp(rawRecoverableSeconds, finishSeconds * 0.025, finishSeconds * 0.12),
  );
  const predictedTargetSeconds = finishSeconds - recoverableSeconds;
  const priorities = topLeaks.map(
    (leak) =>
      `${leak.label}: ${formatTime(leak.recoverableSeconds)} realistic gain. ${leak.recommendation}`,
  );
  const trainingPlan = buildTrainingPlan(topLeaks, predictedTargetSeconds);
  const primaryLeak = topLeaks[0];
  const targetLine =
    targetSeconds > 0
      ? `Your entered target is ${formatTime(targetSeconds)}, leaving ${formatTime(targetGapSeconds)} to find.`
      : "Add a target finish time to see the exact gap you need to close.";

  return {
    raceFormat,
    stationDefinitions,
    level,
    levelLabel: levelLabels[level],
    finishSeconds,
    targetSeconds,
    targetGapSeconds,
    totalRunSeconds,
    totalStationSeconds,
    averageRunSeconds,
    averageRunPace: formatTime(averageRunSeconds),
    firstHalfRunAvg,
    secondHalfRunAvg,
    runFadeSeconds,
    runVolatilitySeconds,
    predictedTargetSeconds,
    recoverableSeconds,
    topLeaks,
    stationResults,
    stationBenchmarkSummary,
    priorities,
    trainingPlan,
    report: `The model projects ${formatTime(finishSeconds)} from these splits. ${targetLine} The biggest recoverable leak is ${primaryLeak?.label.toLowerCase() ?? "not clear yet"}, worth about ${formatTime(primaryLeak?.recoverableSeconds ?? 0)} if trained well. Based on the top three leaks, a realistic next step is ${formatTime(predictedTargetSeconds)} without needing random extra volume.`,
  };
}
