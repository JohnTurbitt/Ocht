import { NextRequest, NextResponse } from "next/server";

// Mirrors sessionCookieName in lib/session.ts. Kept as a local literal
// (rather than importing lib/session.ts, which pulls in node:crypto) so this
// file has no Node.js dependencies and stays safe to run in the Edge
// middleware runtime.
const SESSION_COOKIE_NAME = "ocht_session";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSession) {
    return NextResponse.next();
  }

  const appUrl = request.nextUrl.clone();
  appUrl.pathname = "/app";

  return NextResponse.redirect(appUrl);
}

export const config = {
  matcher: "/",
};
