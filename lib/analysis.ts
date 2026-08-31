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

export type RaceSegment = {
  id: string;
  label: string;
  type: "run" | "station";
  actualSeconds: number;
  targetSeconds: number;
  leakSeconds: number;
  startPercent: number;
  widthPercent: number;
  intensity: number;
  status: "strong" | "steady" | "leak";
};

export type ArchetypeScores = {
  engine: number;
  strength: number;
  durability: number;
  consistency: number;
};

export type AthleteArchetype = {
  id: string;
  label: string;
  tagline: string;
  description: string;
  scores: ArchetypeScores;
  traits: string[];
  confidence: "low" | "medium" | "high";
};

export type Analysis = {
  raceFormat: RaceFormat;
  stationDefinitions: Station[];
  level: Level;
  levelLabel: string;
  finishSeconds: number;
  officialFinishSeconds: number;
  roxzoneSeconds: number;
  roxzonePercent: number;
  roxzonePerTransitionSeconds: number;
  hasRoxzone: boolean;
  archetype: AthleteArchetype;
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
  requiredGainSeconds: number;
  requiredGainPercent: number;
  requiredGainPerRunSeconds: number;
  requiredGainPerStationSeconds: number;
  balancedRunGainSeconds: number;
  balancedStationGainSeconds: number;
  targetRunAverageSeconds: number;
  targetStationAverageSeconds: number;
  targetDifficulty: "on-track" | "realistic" | "aggressive" | "very-aggressive";
  targetDifficultyLabel: string;
  targetPlanSummary: string;
  topLeaks: Leak[];
  stationResults: StationResult[];
  raceSegments: RaceSegment[];
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

// Local copies of lib/raceFormats.ts's runPaceSecPerKm/RaceFormatOption
// distances and lib/validation.ts's plausibility-floor formula — NOT
// imported, deliberately. lib/raceFormats.ts already imports `stations`
// from this file at module-evaluation time (to build raceFormatOptions),
// and lib/validation.ts already imports `stations`/`parseTime` from this
// file too. If this file imported the floor helpers back from either of
// those, it would create a circular module dependency that breaks at load
// time, not just lint. Keep these four values in sync with
// lib/raceFormats.ts's `runPaceSecPerKm`/`RaceFormatOption.runDistanceKm`
// and lib/validation.ts's FLAT_MIN_PLAUSIBLE_SECONDS/RUN_FLOOR_PACE_RATIO/
// STATION_FLOOR_RATIO if those ever change.
const ARCHETYPE_RUN_PACE_SEC_PER_KM: Record<Level, number> = {
  starter: 345,
  competitive: 280,
  elite: 235,
};
const ARCHETYPE_RUN_DISTANCE_KM: Partial<Record<RaceFormat, number>> = {
  hyrox: 1,
  tryka800: 0.8,
  tryka500: 0.5,
};
const FLAT_MIN_PLAUSIBLE_SECONDS = 12;
const RUN_FLOOR_PACE_RATIO = 0.5;
const STATION_FLOOR_RATIO = 0.5;
const NEAR_FLOOR_RATIO = 1.2;
const MIN_COMPARATIVE_MARGIN_SECONDS = 30;

function minPlausibleRunSeconds(raceFormat: RaceFormat): number {
  const distanceKm = ARCHETYPE_RUN_DISTANCE_KM[raceFormat];

  if (distanceKm == null) {
    return FLAT_MIN_PLAUSIBLE_SECONDS;
  }

  return Math.max(
    FLAT_MIN_PLAUSIBLE_SECONDS,
    Math.round(ARCHETYPE_RUN_PACE_SEC_PER_KM.elite * RUN_FLOOR_PACE_RATIO * distanceKm),
  );
}

function minPlausibleStationSeconds(
  station: Station,
  raceFormat: RaceFormat,
): number {
  if (raceFormat === "custom") {
    return FLAT_MIN_PLAUSIBLE_SECONDS;
  }

  return Math.max(
    FLAT_MIN_PLAUSIBLE_SECONDS,
    Math.round(station.benchmarkSec.elite * STATION_FLOOR_RATIO),
  );
}

function tierToConfidence(tier: number): AthleteArchetype["confidence"] {
  if (tier >= 2) {
    return "high";
  }

  return tier === 1 ? "medium" : "low";
}

// "Worst signal wins": near-floor data quality and (when relevant) how
// comfortably a comparative archetype's margin clears its minimum both map
// to a 0/1/2 tier, and the final confidence is the lower of the two. A
// report with clean data but a bare-minimum comparative margin should not
// read as fully confident, and vice versa.
function computeConfidence(
  nearFloorCount: number,
  comparativeMarginSeconds: number | null,
): AthleteArchetype["confidence"] {
  const nearFloorTier = nearFloorCount >= 3 ? 0 : nearFloorCount >= 1 ? 1 : 2;
  const marginTier =
    comparativeMarginSeconds == null
      ? 2
      : comparativeMarginSeconds >= MIN_COMPARATIVE_MARGIN_SECONDS * 2
        ? 2
        : 1;

  return tierToConfidence(Math.min(nearFloorTier, marginTier));
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

function getTargetDifficulty(requiredGainPercent: number, targetGapSeconds: number) {
  if (targetGapSeconds <= 0) {
    return {
      targetDifficulty: "on-track" as const,
      targetDifficultyLabel: "On track",
    };
  }

  if (requiredGainPercent <= 0.035) {
    return {
      targetDifficulty: "realistic" as const,
      targetDifficultyLabel: "Realistic",
    };
  }

  if (requiredGainPercent <= 0.075) {
    return {
      targetDifficulty: "aggressive" as const,
      targetDifficultyLabel: "Aggressive",
    };
  }

  return {
    targetDifficulty: "very-aggressive" as const,
    targetDifficultyLabel: "Very aggressive",
  };
}

function getSegmentStatus(intensity: number): RaceSegment["status"] {
  if (intensity >= 0.66) {
    return "leak";
  }

  if (intensity >= 0.28) {
    return "steady";
  }

  return "strong";
}

function clampScore(value: number) {
  return Math.round(clamp(value, 0, 100));
}

type ArchetypeInputs = {
  runFadeSeconds: number;
  runVolatilitySeconds: number;
  averageStationGap: number;
  stationLeakTotal: number;
  runLeakTotal: number;
  hasRoxzone: boolean;
  roxzonePercent: number;
  hasData: boolean;
  nearFloorCount: number;
};

function buildArchetype({
  runFadeSeconds,
  runVolatilitySeconds,
  averageStationGap,
  stationLeakTotal,
  runLeakTotal,
  hasRoxzone,
  roxzonePercent,
  hasData,
  nearFloorCount,
}: ArchetypeInputs): AthleteArchetype {
  const scores: ArchetypeScores = {
    engine: clampScore(100 - runVolatilitySeconds * 2.4 - runFadeSeconds * 2),
    strength: clampScore(100 - averageStationGap * 1.15),
    durability: clampScore(100 - runFadeSeconds * 3.6),
    consistency: clampScore(100 - runVolatilitySeconds * 3),
  };

  if (!hasData) {
    return {
      id: "unscored",
      label: "Profile pending",
      tagline: "Add your splits",
      description:
        "Enter your run and station splits and Ocht will profile the kind of hybrid athlete your race data describes.",
      scores,
      traits: [],
      confidence: "low",
    };
  }

  const baselineConfidence = computeConfidence(nearFloorCount, null);

  const pick = (
    id: string,
    label: string,
    tagline: string,
    description: string,
    traits: string[],
    confidence: AthleteArchetype["confidence"] = baselineConfidence,
  ): AthleteArchetype => ({
    id,
    label,
    tagline,
    description,
    scores,
    traits,
    confidence,
  });

  // The Morrígan — transition chaos bleeds the clock
  if (hasRoxzone && roxzonePercent >= 0.08) {
    return pick(
      "morrigan",
      "The Morrígan",
      "The race is lost in the in-between",
      "The Morrígan was the goddess of the threshold: the space between life and death, the moment before battle breaks and after it ends. Your moving splits are competitive, but the in-between moments, the dead time around the stations, are where the race slips away. That is exactly where the Morrígan lives. Fast, decisive transitions are the cheapest time you can find.",
      ["Strong moving splits", "Transition-heavy losses", "High-value quick wins"],
    );
  }

  // Setanta — wild, uneven rhythm across splits
  if (scores.consistency < 50) {
    return pick(
      "setanta",
      "Setanta",
      "Raw power, no rhythm yet",
      "Setanta was the boy's name of Cú Chulainn, before he'd earned it. He had extraordinary strength from the start, but it came without control. He accidentally killed Culann's guard dog in a moment of unthinking force and had to take its place as penance. Your splits show the same profile: a real engine that surges and dips wildly, where the surges cost more than they gain. The power is already there. Pacing discipline is the craft that shapes it.",
      ["High power output", "Inconsistent pacing", "Needs rhythm and control"],
    );
  }

  // Cú Chulainn — severe fade, burns too hot early
  if (scores.durability < 42) {
    return pick(
      "cu-chulainn",
      "Cú Chulainn",
      "All-out from the start. The back half pays for it.",
      "Cú Chulainn's defining power was the ríastrad, the battle warp-spasm, where he became an unstoppable force of nature. But the ríastrad consumed everything he had. Witnesses said he was unrecognisable afterwards, spent completely. Your race follows that arc: you go deep into the red early and the back half costs you heavily for it. The aggression is an asset. Channelling it into a pace that holds is where the time is.",
      ["Explosive early pace", "Severe second-half fade", "Pacing the key lever"],
    );
  }

  // Brigid — moderate fade paired with station weakness
  if (scores.durability < 60 && scores.strength < 62) {
    return pick(
      "brigid",
      "Brigid",
      "Two fires need stoking",
      "Brigid was goddess of the forge and of healing, two entirely separate crafts, each with its own fire that needed tending. Let one go cold and the work suffered. Your race shows the same two flames: the runs fade in the second half, and the strength stations add to the cost on top of that. Neither alone is decisive, but together they matter. Two training targets, tended in parallel.",
      ["Moderate second-half fade", "Station-limited", "Dual-focus training needed"],
    );
  }

  // Oisín — moderate fade but stations hold up
  if (scores.durability < 60) {
    return pick(
      "oisin",
      "Oisín",
      "Strong through the middle. The back half catches up.",
      "Oisín was the greatest runner of the Fianna, celebrated for his speed and grace. He spent what felt like a few years in Tír na nÓg, the Land of Eternal Youth, but it was three hundred years in Ireland. When he returned and touched the ground, every one of those years hit him at once. Your race has that shape: strong, fluid running early, then the back half arrives all at once. Your stations hold up. Sustained aerobic work will keep the running with them.",
      ["Stations hold up", "Run endurance fades late", "Second-half pace drops"],
    );
  }

  // Fionn mac Cumhaill — strong engine, stations the limiter
  const fionnMargin = stationLeakTotal - runLeakTotal;

  if (
    stationLeakTotal > runLeakTotal * 1.4 &&
    fionnMargin >= MIN_COMPARATIVE_MARGIN_SECONDS
  ) {
    return pick(
      "fionn",
      "Fionn mac Cumhaill",
      "The run engine leads. The stations are the gap.",
      "Entry to the Fianna required a warrior to run at full pace through a dense forest without breaking a single twig underfoot or disturbing their braided hair. Fionn led this band of elite warrior-runners, and his ability across the ground was their standard. Your race shows the same quality: the runs carry you. The strength stations are where time is left behind. Strength-endurance work and station technique under fatigue are where your next gains live.",
      ["Strong run engine", "Station-limited", "Targets workout stations"],
      computeConfidence(nearFloorCount, fionnMargin),
    );
  }

  // The Dagda — strong stations, running is the limiter
  const dagdaMargin = runLeakTotal - stationLeakTotal;

  if (
    runLeakTotal > stationLeakTotal * 1.4 &&
    dagdaMargin >= MIN_COMPARATIVE_MARGIN_SECONDS
  ) {
    return pick(
      "dagda",
      "The Dagda",
      "Immovable at the stations. The runs cost you.",
      "The Dagda was the father of the gods: enormous, immovable and endlessly powerful. He carried a club so heavy it had to be dragged on a cart, and his cauldron never ran empty. He was not built for grace or speed. He was built to endure and to outlast. Your stations show that same quality. The runs are where time slips away. Aerobic running volume and pacing discipline are your biggest opportunity.",
      ["Strong stations", "Run-limited", "Needs aerobic running base"],
      computeConfidence(nearFloorCount, dagdaMargin),
    );
  }

  // Lugh — even, durable, master of all skills
  if (scores.consistency >= 78 && scores.durability >= 72) {
    return pick(
      "lugh",
      "Lugh",
      "Master of every discipline, no single weakness",
      "When Lugh arrived at the gates of Tara, the doorkeeper asked what skill he brought. He named a craft. 'We already have one of those.' He named another. 'We have one.' This went on until Lugh asked: 'But do you have one man who masters all of them at once?' He was let in immediately. Your race profile is Lugh's answer: no single phase dominates your losses, you hold pace to the end and every discipline is present. That breadth is the foundation. Sharpen the edges and you move up.",
      ["Even pacing", "Durable to the finish", "Well-rounded profile"],
    );
  }

  // Cormac mac Airt — balanced, no single dominant limiter
  return pick(
    "cormac",
    "Cormac mac Airt",
    "The balanced king: solid foundation, broad upside",
    "Cormac mac Airt ruled Tara as the ideal high king, not because he was the greatest fighter or the fastest runner, but because he was fair, wise and balanced across every duty of kingship. His court was respected for that wholeness. Your race has the same quality: no single discipline is driving the losses, and no single discipline is carrying it either. The foundation is solid. A balanced block that targets the top leaks while protecting your strengths is how you move up.",
    ["Balanced losses", "No single limiter", "Broad upside"],
  );
}

export function buildAnalysis(
  goal: string,
  targetTime: string,
  level: Level,
  runs: string[],
  stationSplits: Record<StationKey, string>,
  stationDefinitions: Station[] = stations,
  raceFormat: RaceFormat = "hyrox",
  officialFinishTime: string = "",
): Analysis {
  const runSeconds = runs.map(parseTime);
  const totalRunSeconds = runSeconds.reduce((total, split) => total + split, 0);
  const totalValidRuns = runSeconds.filter((split) => split > 0).length || 8;
  const averageRunSeconds = totalRunSeconds / totalValidRuns;
  const firstHalfRunAvg = average(runSeconds.slice(0, 4));
  const secondHalfRunAvg = average(runSeconds.slice(4));
  const runFadeSeconds = Math.max(0, secondHalfRunAvg - firstHalfRunAvg);
  const runVolatilitySeconds = standardDeviation(runSeconds);

  const orderedStationResults = stationDefinitions
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
    });
  const stationResults = [...orderedStationResults].sort((a, b) => b.score - a.score);
  const stationBenchmarkSummary = `Station leaks are measured against ${levelLabels[level]} benchmarks. Run fade and pacing volatility are calculated from your own run splits.`;

  const totalStationSeconds = stationResults.reduce(
    (total, station) => total + station.seconds,
    0,
  );
  const finishSeconds = totalRunSeconds + totalStationSeconds;
  const targetSeconds = parseTime(targetTime);
  const targetGapSeconds = Math.max(0, finishSeconds - targetSeconds);
  const runCount = runSeconds.filter((split) => split > 0).length || runs.length || 1;
  const stationCount =
    stationResults.filter((station) => station.seconds > 0).length ||
    stationDefinitions.length ||
    1;
  const requiredGainSeconds = targetSeconds > 0 ? targetGapSeconds : 0;
  const requiredGainPercent =
    finishSeconds > 0 ? requiredGainSeconds / finishSeconds : 0;
  const requiredGainPerRunSeconds = requiredGainSeconds / runCount;
  const requiredGainPerStationSeconds = requiredGainSeconds / stationCount;
  const balancedRunGainSeconds = requiredGainSeconds * 0.45 / runCount;
  const balancedStationGainSeconds = requiredGainSeconds * 0.55 / stationCount;
  const targetRunAverageSeconds = Math.max(
    0,
    averageRunSeconds - balancedRunGainSeconds,
  );
  const averageStationSeconds = totalStationSeconds / stationCount;
  const targetStationAverageSeconds = Math.max(
    0,
    averageStationSeconds - balancedStationGainSeconds,
  );
  const { targetDifficulty, targetDifficultyLabel } = getTargetDifficulty(
    requiredGainPercent,
    targetGapSeconds,
  );

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
  const targetPlanSummary =
    targetSeconds > 0 && requiredGainSeconds > 0
      ? `To hit ${formatTime(targetSeconds)}, find ${formatTime(requiredGainSeconds)} total: ${formatTime(requiredGainPerRunSeconds)} per run, ${formatTime(requiredGainPerStationSeconds)} per station, or a balanced plan around ${formatTime(balancedRunGainSeconds)} per run plus ${formatTime(balancedStationGainSeconds)} per station.`
      : targetSeconds > 0
        ? `Your current projection is already at or ahead of ${formatTime(targetSeconds)}. Protect pacing and avoid giving time back.`
        : "Add a target finish time to generate a target split plan.";
  const maxSegmentLeak = Math.max(
    1,
    ...runSeconds.map((seconds) =>
      Math.max(0, seconds - targetRunAverageSeconds),
    ),
    ...orderedStationResults.map((station) =>
      Math.max(0, station.seconds - targetStationAverageSeconds),
    ),
  );
  let elapsedSeconds = 0;
  const raceSegments = runSeconds.flatMap((seconds, index) => {
    const station = orderedStationResults[index];
    const runLeak = Math.max(0, seconds - targetRunAverageSeconds);
    const runSegment: RaceSegment = {
      id: `run-${index + 1}`,
      label: `Run ${index + 1}`,
      type: "run",
      actualSeconds: seconds,
      targetSeconds: targetRunAverageSeconds,
      leakSeconds: runLeak,
      startPercent: finishSeconds > 0 ? (elapsedSeconds / finishSeconds) * 100 : 0,
      widthPercent: finishSeconds > 0 ? (seconds / finishSeconds) * 100 : 0,
      intensity: clamp(runLeak / maxSegmentLeak, 0, 1),
      status: getSegmentStatus(runLeak / maxSegmentLeak),
    };

    elapsedSeconds += seconds;

    if (!station) {
      return [runSegment];
    }

    const stationLeak = Math.max(0, station.seconds - targetStationAverageSeconds);
    const stationSegment: RaceSegment = {
      id: `station-${station.key}`,
      label: station.label,
      type: "station",
      actualSeconds: station.seconds,
      targetSeconds: targetStationAverageSeconds,
      leakSeconds: stationLeak,
      startPercent: finishSeconds > 0 ? (elapsedSeconds / finishSeconds) * 100 : 0,
      widthPercent: finishSeconds > 0 ? (station.seconds / finishSeconds) * 100 : 0,
      intensity: clamp(stationLeak / maxSegmentLeak, 0, 1),
      status: getSegmentStatus(stationLeak / maxSegmentLeak),
    };

    elapsedSeconds += station.seconds;

    return [runSegment, stationSegment];
  });

  const officialFinishSeconds = parseTime(officialFinishTime);
  const hasRoxzone = officialFinishSeconds > finishSeconds && finishSeconds > 0;
  const roxzoneSeconds = hasRoxzone ? officialFinishSeconds - finishSeconds : 0;
  const roxzoneDenominator =
    officialFinishSeconds > 0 ? officialFinishSeconds : finishSeconds;
  const roxzonePercent =
    roxzoneDenominator > 0 ? roxzoneSeconds / roxzoneDenominator : 0;
  const roxzonePerTransitionSeconds = roxzoneSeconds / stationCount;

  const stationLeakTotal = orderedStationResults.reduce(
    (total, station) => total + station.gap,
    0,
  );
  const archetypeRunDistanceKm = ARCHETYPE_RUN_DISTANCE_KM[raceFormat];
  const runBenchmarkSeconds =
    archetypeRunDistanceKm == null
      ? null
      : ARCHETYPE_RUN_PACE_SEC_PER_KM[level] * archetypeRunDistanceKm;
  const runGapTotal =
    runBenchmarkSeconds == null
      ? null
      : runSeconds.reduce(
          (total, seconds) => total + Math.max(0, seconds - runBenchmarkSeconds),
          0,
        );
  // For a custom format (no fixed run distance), there's no external
  // benchmark to compare against, so the run side of the Fionn/Dagda
  // comparison falls back to the old self-relative fade+volatility measure
  // — the only signal available without a real distance to anchor to.
  const runLeakTotal = runGapTotal ?? runFadeSeconds * 4 + runVolatilitySeconds * 3.2;
  const runFloorSeconds = minPlausibleRunSeconds(raceFormat);
  const nearFloorRunCount = runSeconds.filter(
    (seconds) => seconds <= runFloorSeconds * NEAR_FLOOR_RATIO,
  ).length;
  const nearFloorStationCount = orderedStationResults.filter(
    (station) =>
      station.seconds <=
      minPlausibleStationSeconds(station, raceFormat) * NEAR_FLOOR_RATIO,
  ).length;
  const nearFloorCount = nearFloorRunCount + nearFloorStationCount;
  const archetype = buildArchetype({
    runFadeSeconds,
    runVolatilitySeconds,
    averageStationGap: stationLeakTotal / stationCount,
    stationLeakTotal,
    runLeakTotal,
    hasRoxzone,
    roxzonePercent,
    hasData: finishSeconds > 0,
    nearFloorCount,
  });

  return {
    raceFormat,
    stationDefinitions,
    level,
    levelLabel: levelLabels[level],
    finishSeconds,
    officialFinishSeconds,
    roxzoneSeconds,
    roxzonePercent,
    roxzonePerTransitionSeconds,
    hasRoxzone,
    archetype,
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
    requiredGainSeconds,
    requiredGainPercent,
    requiredGainPerRunSeconds,
    requiredGainPerStationSeconds,
    balancedRunGainSeconds,
    balancedStationGainSeconds,
    targetRunAverageSeconds,
    targetStationAverageSeconds,
    targetDifficulty,
    targetDifficultyLabel,
    targetPlanSummary,
    topLeaks,
    stationResults,
    raceSegments,
    stationBenchmarkSummary,
    priorities,
    trainingPlan,
    report: `The model projects ${formatTime(finishSeconds)} from these splits. ${targetLine} The biggest recoverable leak is ${primaryLeak?.label.toLowerCase() ?? "not clear yet"}, worth about ${formatTime(primaryLeak?.recoverableSeconds ?? 0)} if trained well. Based on the top three leaks, a realistic next step is ${formatTime(predictedTargetSeconds)} without needing random extra volume.`,
  };
}

export function tierFor(score: number): { cls: string; label: string } {
  if (score >= 70) return { cls: "high", label: "Elite" };
  if (score >= 45) return { cls: "mid", label: "Pro" };
  return { cls: "low", label: "Finisher" };
}
