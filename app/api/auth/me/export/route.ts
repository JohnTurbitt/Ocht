import { NextRequest, NextResponse } from "next/server";
import { StationKey } from "@/lib/analysis";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { toPublicUser } from "@/lib/profile";
import { toSavedReport } from "@/lib/reportPersistence";

export async function GET(request: NextRequest) {
  const user = await requireCurrentUser(request);

  if (!user) {
    return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
  }

  try {
    const [databaseUser, reports] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          name: true,
          subscription: true,
          defaultLevel: true,
          defaultTargetTime: true,
          createdAt: true,
        },
      }),
      prisma.raceReport.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!databaseUser) {
      return NextResponse.json({ errors: ["Account not found."] }, { status: 404 });
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      account: toPublicUser(databaseUser),
      reports: reports.map((report) =>
        toSavedReport({
          id: report.id,
          createdAt: report.createdAt,
          goal: report.goal,
          targetTime: report.targetTime,
          athleteLevel: report.athleteLevel,
          runSplits: report.runSplits,
          stationSplits: report.stationSplits as Record<StationKey, string>,
          trainingContext: report.trainingContext,
          finishSeconds: report.finishSeconds,
          predictedTargetSeconds: report.predictedTargetSeconds,
          topLeakLabel: report.topLeakLabel,
          analysisSnapshot: report.analysisSnapshot,
        }),
      ),
    };

    return NextResponse.json(exportPayload, {
      headers: {
        "Content-Disposition": 'attachment; filename="ocht-data-export.json"',
      },
    });
  } catch (error) {
    logServerError("Account data export failed", error);

    return NextResponse.json(
      { errors: ["Your data export could not be generated."] },
      { status: 500 },
    );
  }
}
