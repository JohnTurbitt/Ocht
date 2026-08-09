import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/stravaTokens";
import { syncStravaProfile } from "@/lib/stravaSyncService";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const scope = searchParams.get("scope") ?? "";
  const cookieState = request.cookies.get("strava_oauth_state")?.value;

  if (!state || state !== cookieState) {
    return NextResponse.json({ errors: ["Invalid OAuth state."] }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const clearState = (res: NextResponse) => {
    res.cookies.set("strava_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (!scope.includes("activity:read_all")) {
    return clearState(NextResponse.redirect(`${appUrl}/?strava=insufficient_scope`, 302));
  }

  try {
    const tokenRes = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return clearState(NextResponse.redirect(`${appUrl}/?strava=error`, 302));
    }

    const data = await tokenRes.json();

    await prisma.stravaConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stravaAthleteId: data.athlete.id,
        accessToken: encryptToken(data.access_token),
        refreshToken: encryptToken(data.refresh_token),
        expiresAt: new Date(data.expires_at * 1000),
        scope,
      },
      update: {
        stravaAthleteId: data.athlete.id,
        accessToken: encryptToken(data.access_token),
        refreshToken: encryptToken(data.refresh_token),
        expiresAt: new Date(data.expires_at * 1000),
        scope,
        revokedAt: null,
      },
    });

    syncStravaProfile(user.id).catch((err) =>
      logServerError("Post-connect Strava sync failed", err),
    );

    return clearState(NextResponse.redirect(`${appUrl}/?strava=connected`, 302));
  } catch (err) {
    logServerError("Strava callback error", err);
    return clearState(NextResponse.redirect(`${appUrl}/?strava=error`, 302));
  }
}
