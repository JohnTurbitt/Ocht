import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { hashSessionToken, sessionCookieName } from "@/lib/session";

export async function POST(request: NextRequest) {
  const guardResponse = await guardBrowserMutation(request, {
    key: "auth-logout",
    limit: 30,
    windowMs: 5 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const token = request.cookies.get(sessionCookieName)?.value;

  if (token) {
    await prisma.userSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.delete(sessionCookieName);

  return response;
}
