import type { StravaActivity } from "@/lib/stravaTypes";

export interface TrainingContextMetrics {
  runsPerWeek: number;
  weeklyDistanceKm: number;
  longestRunKm: number;
  hardRunsPerWeek: number;
  restDaysPerWeek: number;
}

export interface BestEffortMetrics {
  bestEffort5kSeconds: number | null;
  bestEffort10kSeconds: number | null;
}

export interface TrainingLoadMetrics {
  ctlScore: number;
  atlScore: number;
}

export interface PaceZone {
  minPaceSec: number;
  maxPaceSec: number;
}

export interface PaceZones {
  z1: PaceZone;
  z2: PaceZone;
  z3: PaceZone;
  z4: PaceZone;
  z5: PaceZone;
}

export function computeTrainingContext(activities: StravaActivity[]): TrainingContextMetrics {
  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const runs = activities.filter(
    (a) => a.type === "Run" && new Date(a.start_date).getTime() > cutoff,
  );

  if (runs.length === 0) {
    return { runsPerWeek: 0, weeklyDistanceKm: 0, longestRunKm: 0, hardRunsPerWeek: 0, restDaysPerWeek: 7 };
  }

  const totalDistanceKm = runs.reduce((sum, r) => sum + r.distance / 1000, 0);
  const longestRunKm = runs.reduce((max, r) => Math.max(max, r.distance / 1000), 0);
  const hardRuns = runs.filter((r) => (r.suffer_score ?? 0) > 50).length;
  const runDays = new Set(runs.map((r) => r.start_date.slice(0, 10))).size;

  return {
    runsPerWeek: runs.length / 4,
    weeklyDistanceKm: Math.round((totalDistanceKm / 4) * 10) / 10,
    longestRunKm: Math.round(longestRunKm * 10) / 10,
    hardRunsPerWeek: Math.round((hardRuns / 4) * 10) / 10,
    restDaysPerWeek: Math.round((7 - runDays / 4) * 10) / 10,
  };
}

function riegelExtrap(timeSec: number, distM: number, targetM: number): number {
  return timeSec * Math.pow(targetM / distM, 1.06);
}

export function computeBestEfforts(activities: StravaActivity[]): BestEffortMetrics {
  const runs = activities.filter((a) => a.type === "Run" && a.distance >= 3000);
  let best5k: number | null = null;
  let best10k: number | null = null;

  for (const run of runs) {
    const p5k = riegelExtrap(run.moving_time, run.distance, 5000);
    const p10k = riegelExtrap(run.moving_time, run.distance, 10000);
    if (best5k === null || p5k < best5k) best5k = p5k;
    if (best10k === null || p10k < best10k) best10k = p10k;
  }

  return {
    bestEffort5kSeconds: best5k !== null ? Math.round(best5k) : null,
    bestEffort10kSeconds: best10k !== null ? Math.round(best10k) : null,
  };
}

export function computeLTHR(activities: StravaActivity[]): number | null {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const qualifying = activities.filter(
    (a) =>
      a.type === "Run" &&
      new Date(a.start_date).getTime() > cutoff &&
      a.moving_time >= 1800 &&
      a.average_heartrate != null,
  );

  if (qualifying.length === 0) return null;

  const best = qualifying.reduce((top, a) =>
    (a.average_heartrate ?? 0) > (top.average_heartrate ?? 0) ? a : top,
  );

  return Math.round(0.95 * best.average_heartrate!);
}

export function computeCardiacDecoupling(activities: StravaActivity[]): number | null {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const longRuns = activities
    .filter(
      (a) =>
        a.type === "Run" &&
        new Date(a.start_date).getTime() > cutoff &&
        a.moving_time >= 3600 &&
        a.average_heartrate != null &&
        a.average_speed > 0,
    )
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    .slice(0, 4);

  if (longRuns.length < 2) return null;

  const couplings = longRuns.map((r) => r.average_heartrate! / r.average_speed);
  const best = Math.min(...couplings);
  const worst = Math.max(...couplings);

  return Math.round(((worst - best) / best) * 100 * 10) / 10;
}

export function computeTrainingLoad(activities: StravaActivity[]): TrainingLoadMetrics {
  const runs = activities
    .filter((a) => a.type === "Run" && a.average_heartrate != null)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const dailyStress: Record<string, number> = {};
  for (const run of runs) {
    const day = run.start_date.slice(0, 10);
    const stress = (run.moving_time / 60) * run.average_heartrate! / 100;
    dailyStress[day] = (dailyStress[day] ?? 0) + stress;
  }

  const now = Date.now();
  let ctl = 0;
  let atl = 0;

  for (let i = 89; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const stress = dailyStress[d] ?? 0;
    ctl = ctl + (1 / 42) * (stress - ctl);
    atl = atl + (1 / 7) * (stress - atl);
  }

  return {
    ctlScore: Math.round(ctl * 10) / 10,
    atlScore: Math.round(atl * 10) / 10,
  };
}

export function computePaceZones(bestEffort5kSeconds: number | null): PaceZones | null {
  if (!bestEffort5kSeconds) return null;

  const pace5k = bestEffort5kSeconds / 5;

  return {
    z1: { minPaceSec: Math.round(pace5k * 1.4), maxPaceSec: 9999 },
    z2: { minPaceSec: Math.round(pace5k * 1.2), maxPaceSec: Math.round(pace5k * 1.4) - 1 },
    z3: { minPaceSec: Math.round(pace5k * 1.05), maxPaceSec: Math.round(pace5k * 1.2) - 1 },
    z4: { minPaceSec: Math.round(pace5k * 1.0), maxPaceSec: Math.round(pace5k * 1.05) - 1 },
    z5: { minPaceSec: 0, maxPaceSec: Math.round(pace5k * 1.0) - 1 },
  };
}
