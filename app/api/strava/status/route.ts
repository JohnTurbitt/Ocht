import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ connected: false, syncedAt: null, hasProfile: false });

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId: user.id },
    include: { profile: true },
  });

  if (!connection || connection.revokedAt) {
    return NextResponse.json({ connected: false, syncedAt: null, hasProfile: false });
  }

  return NextResponse.json({
    connected: true,
    syncedAt: connection.profile?.lastSyncedAt?.toISOString() ?? null,
    hasProfile: !!connection.profile,
  });
}
