import { prisma } from "./prisma";
import { getActivities } from "./stravaClient";
import {
  computeBestEfforts,
  computeCardiacDecoupling,
  computeLTHR,
  computePaceZones,
  computeTrainingContext,
  computeTrainingLoad,
} from "./stravaMetrics";

export async function syncStravaProfile(userId: string): Promise<void> {
  const connection = await prisma.stravaConnection.findUnique({ where: { userId } });
  if (!connection) throw new Error("No Strava connection");

  const after = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
  const activities = await getActivities(userId, { perPage: 200, after });

  const context = computeTrainingContext(activities);
  const bestEfforts = computeBestEfforts(activities);
  const lthrBpm = computeLTHR(activities);
  const cardiacDecouplingPct = computeCardiacDecoupling(activities);
  const load = computeTrainingLoad(activities);
  const paceZones = computePaceZones(bestEfforts.bestEffort5kSeconds);

  await prisma.stravaProfile.upsert({
    where: { connectionId: connection.id },
    create: {
      connectionId: connection.id,
      userId,
      lthrBpm,
      cardiacDecouplingPct,
      ctlScore: load.ctlScore,
      atlScore: load.atlScore,
      bestEffort5kSeconds: bestEfforts.bestEffort5kSeconds,
      bestEffort10kSeconds: bestEfforts.bestEffort10kSeconds,
      paceZonesJson: paceZones ?? undefined,
      runsPerWeek: context.runsPerWeek,
      weeklyDistanceKm: context.weeklyDistanceKm,
      longestRunKm: context.longestRunKm,
      hardRunsPerWeek: context.hardRunsPerWeek,
      restDaysPerWeek: context.restDaysPerWeek,
      lastSyncedAt: new Date(),
    } as Parameters<typeof prisma.stravaProfile.upsert>[0]["create"],
    update: {
      lthrBpm,
      cardiacDecouplingPct,
      ctlScore: load.ctlScore,
      atlScore: load.atlScore,
      bestEffort5kSeconds: bestEfforts.bestEffort5kSeconds,
      bestEffort10kSeconds: bestEfforts.bestEffort10kSeconds,
      paceZonesJson: paceZones ?? undefined,
      runsPerWeek: context.runsPerWeek,
      weeklyDistanceKm: context.weeklyDistanceKm,
      longestRunKm: context.longestRunKm,
      hardRunsPerWeek: context.hardRunsPerWeek,
      restDaysPerWeek: context.restDaysPerWeek,
      lastSyncedAt: new Date(),
    } as Parameters<typeof prisma.stravaProfile.upsert>[0]["update"],
  });
}
