import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail, verifyPassword } from "@/lib/auth";
import { authServiceError } from "@/lib/apiErrors";
import { validateAuthPayload } from "@/lib/apiValidation";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { toPublicUser } from "@/lib/profile";
import { guardBrowserMutation } from "@/lib/security";
import {
  createSessionToken,
  getSessionCookieOptions,
  getSessionExpiry,
  hashSessionToken,
  sessionCookieName,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "auth-login",
    limit: 12,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const validation = validateAuthPayload(await request.json().catch(() => null));

  if (!validation.valid || !validation.value) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(validation.value.email) },
    });

    if (
      !user ||
      !(await verifyPassword(validation.value.password, user.passwordHash))
    ) {
      return NextResponse.json(
        { errors: ["Email or password is incorrect."] },
        { status: 401 },
      );
    }

    const token = createSessionToken();

    // Logins create a new session rather than replacing old ones, which allows
    // multiple browsers/devices to stay signed in independently.
    await prisma.userSession.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: getSessionExpiry(),
      },
    });

    const response = NextResponse.json({ user: toPublicUser(user) });

    response.cookies.set(sessionCookieName, token, getSessionCookieOptions());

    return response;
  } catch (error) {
    logServerError("Login failed", error);

    return authServiceError();
  }
}
