import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { guardBrowserMutation } from "@/lib/security";
import { syncStravaProfile } from "@/lib/stravaSyncService";

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "strava-sync",
    limit: 1,
    windowMs: 60 * 60 * 1000,
  });
  if (guardResponse) return guardResponse;

  const user = await requireCurrentUser(request);
  if (!user) return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });

  try {
    await syncStravaProfile(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logServerError("Manual Strava sync failed", err);
    return NextResponse.json({ errors: ["Sync failed."] }, { status: 500 });
  }
}
