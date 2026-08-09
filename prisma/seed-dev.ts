// Dev-only fixture seeding — populates a handful of fake accounts with race
// history so the app has realistic data to browse locally. None of these
// accounts get a StravaConnection row; connect Strava with your own account
// instead so that flow is tested against a real Strava login.
//
// Run from the repo root: npx tsx prisma/seed-dev.ts
//
// Safe to re-run: it deletes and recreates the fake accounts each time.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// `.env` is saved UTF-8 with a BOM, which process.loadEnvFile does not strip
// (see prisma.config.ts for the same gotcha on the Prisma CLI side).
function loadEnvFile(path: string) {
  const envPath = join(process.cwd(), path);
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, "utf8");
  const contents = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env");

import { buildAnalysis, formatTime, Level, parseTime } from "../lib/analysis";
import { hashPassword, normalizeEmail } from "../lib/auth";
import {
  ReportPreset,
  sampleReportPreset,
  tryka500Preset,
  tryka800Preset,
} from "../lib/reportPresets";
import { toPersistableRaceReport } from "../lib/reportPersistence";
import { getRaceFormatStations } from "../lib/raceFormats";

const DEV_PASSWORD = "OchtDevPass123!";

const athleteLevelByLevel: Record<Level, "STARTER" | "COMPETITIVE" | "ELITE"> = {
  starter: "STARTER",
  competitive: "COMPETITIVE",
  elite: "ELITE",
};

type FakeUserSpec = {
  email: string;
  name: string;
  level: Level;
  preset: ReportPreset;
  reportBiasSeconds: number[];
  reportDaysAgo: number[];
};

const FAKE_USERS: FakeUserSpec[] = [
  {
    email: "alex.starter@ocht.dev",
    name: "Alex Rivera",
    level: "starter",
    preset: tryka500Preset,
    reportBiasSeconds: [55, 40, 26, 16, 6, 0],
    reportDaysAgo: [70, 56, 42, 28, 14, 4],
  },
  {
    email: "jordan.competitive@ocht.dev",
    name: "Jordan Blake",
    level: "competitive",
    preset: sampleReportPreset,
    reportBiasSeconds: [50, 36, 24, 14, 6, 0],
    reportDaysAgo: [70, 56, 42, 28, 14, 4],
  },
  {
    email: "sam.elite@ocht.dev",
    name: "Sam Okafor",
    level: "elite",
    preset: sampleReportPreset,
    reportBiasSeconds: [10, 0, -10, -18, -24, -30],
    reportDaysAgo: [70, 56, 42, 28, 14, 4],
  },
  {
    email: "riley.tryka800@ocht.dev",
    name: "Riley Chen",
    level: "competitive",
    preset: tryka800Preset,
    reportBiasSeconds: [45, 32, 20, 12, 4, -4],
    reportDaysAgo: [63, 49, 35, 21, 10, 3],
  },
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shiftTime(value: string, biasSeconds: number, jitterSeconds: number): string {
  const seconds = parseTime(value);
  if (seconds <= 0) return value;
  const shifted = seconds + biasSeconds + randInt(-jitterSeconds, jitterSeconds);
  return formatTime(Math.max(10, shifted));
}

function buildVariant(preset: ReportPreset, biasSeconds: number): ReportPreset {
  return {
    ...preset,
    runs: preset.runs.map((split) => shiftTime(split, biasSeconds, 4)),
    stationSplits: Object.fromEntries(
      Object.entries(preset.stationSplits).map(([key, split]) => [
        key,
        shiftTime(split, biasSeconds, 6),
      ]),
    ),
  };
}

async function main() {
  const { prisma } = await import("../lib/prisma");

  const fakeEmails = FAKE_USERS.map((spec) => normalizeEmail(spec.email));
  await prisma.user.deleteMany({ where: { email: { in: fakeEmails } } });

  const passwordHash = await hashPassword(DEV_PASSWORD);

  for (const spec of FAKE_USERS) {
    const email = normalizeEmail(spec.email);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: spec.name,
        defaultLevel: athleteLevelByLevel[spec.level],
        defaultTargetTime: spec.preset.targetTime,
        subscription: "ACTIVE",
        emailVerifiedAt: new Date(),
        onboardingCompletedAt: new Date(),
      },
    });

    const stationDefinitions = getRaceFormatStations(spec.preset.raceFormat);

    for (let i = 0; i < spec.reportBiasSeconds.length; i++) {
      const variant = buildVariant(spec.preset, spec.reportBiasSeconds[i]);
      const analysis = buildAnalysis(
        variant.goal,
        variant.targetTime,
        spec.level,
        variant.runs,
        variant.stationSplits,
        stationDefinitions,
        spec.preset.raceFormat,
      );
      const reportData = toPersistableRaceReport({
        raceFormat: spec.preset.raceFormat,
        goal: variant.goal,
        targetTime: variant.targetTime,
        level: spec.level,
        runs: variant.runs,
        stationDefinitions,
        stationSplits: variant.stationSplits,
        analysis,
      });
      const createdAt = new Date(
        Date.now() - spec.reportDaysAgo[i] * 24 * 60 * 60 * 1000,
      );

      await prisma.raceReport.create({
        data: {
          userId: user.id,
          goal: reportData.goal,
          targetTime: reportData.targetTime,
          athleteLevel: reportData.athleteLevel,
          runSplits: reportData.runSplits,
          stationSplits: reportData.stationSplits,
          finishSeconds: reportData.finishSeconds,
          predictedTargetSeconds: reportData.predictedTargetSeconds,
          topLeakLabel: reportData.topLeakLabel,
          analysisSnapshot: reportData.analysisSnapshot,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }

    console.log(`Seeded ${email} — ${spec.reportBiasSeconds.length} reports, no Strava connection.`);
  }

  console.log("\nAll fake accounts use the password:", DEV_PASSWORD);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
