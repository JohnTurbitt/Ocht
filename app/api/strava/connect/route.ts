import { createHmac, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/apiAuth";

function buildStateToken(userId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}:${Date.now()}:${nonce}`;
  const sig = createHmac("sha256", process.env.STRAVA_CLIENT_SECRET!)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const state = buildStateToken(user.id);

  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${appUrl}/api/strava/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "activity:read_all,profile:read_all");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString(), 302);
  response.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    maxAge: 5 * 60,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
