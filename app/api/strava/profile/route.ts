import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });

  const profile = await prisma.stravaProfile.findUnique({
    where: { userId: user.id },
    select: {
      runsPerWeek: true,
      weeklyDistanceKm: true,
      longestRunKm: true,
      hardRunsPerWeek: true,
      restDaysPerWeek: true,
      lthrBpm: true,
      ctlScore: true,
      atlScore: true,
      lastSyncedAt: true,
    },
  });

  return NextResponse.json({ profile: profile ?? null });
}
