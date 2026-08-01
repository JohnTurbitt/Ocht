import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { getValidAccessToken } from "@/lib/stravaTokens";

export async function DELETE(request: NextRequest) {
  const guardResponse = await guardBrowserMutation(request, {
    key: "strava-disconnect",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (guardResponse) return guardResponse;

  const user = await requireCurrentUser(request);
  if (!user) return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });

  try {
    const token = await getValidAccessToken(user.id).catch(() => null);
    if (token) {
      await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => logServerError("Strava deauthorize failed", err));
    }

    await prisma.stravaProfile.deleteMany({ where: { userId: user.id } });
    await prisma.stravaConnection.deleteMany({ where: { userId: user.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logServerError("Strava disconnect failed", err);
    return NextResponse.json({ errors: ["Disconnect failed."] }, { status: 500 });
  }
}
