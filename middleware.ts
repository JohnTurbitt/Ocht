import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName } from "./lib/sessionCookieName";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(sessionCookieName);

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
