import { NextRequest, NextResponse } from "next/server";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import { signupError } from "@/lib/apiErrors";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { validateAuthPayload } from "@/lib/apiValidation";
import { toPublicUser } from "@/lib/profile";
import { trySendVerificationEmailForUser } from "@/lib/emailVerification";
import { logServerError } from "@/lib/logging";
import {
  createSessionToken,
  getSessionCookieOptions,
  getSessionExpiry,
  hashSessionToken,
  sessionCookieName,
} from "@/lib/session";

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "auth-signup",
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const validation = validateAuthPayload(await request.json().catch(() => null));

  if (!validation.valid || !validation.value) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const betaSignupCode = process.env.BETA_SIGNUP_CODE?.trim();

  if (
    betaSignupCode &&
    validation.value.signupCode?.trim() !== betaSignupCode
  ) {
    return NextResponse.json(
      { errors: ["Enter a valid beta signup code."] },
      { status: 403 },
    );
  }

  try {
    const email = normalizeEmail(validation.value.email);
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return NextResponse.json(
        { errors: ["An account already exists for that email."] },
        { status: 409 },
      );
    }

    const token = createSessionToken();
    // Create the user and first session together so a successful signup leaves the
    // browser authenticated immediately.
    const user = await prisma.user.create({
      data: {
        email,
        name: validation.value.name,
        passwordHash: await hashPassword(validation.value.password),
        sessions: {
          create: {
            tokenHash: hashSessionToken(token),
            expiresAt: getSessionExpiry(),
          },
        },
      },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        name: true,
        subscription: true,
        defaultLevel: true,
        defaultTargetTime: true,
        createdAt: true,
      },
    });
    const response = NextResponse.json(
      { user: toPublicUser(user) },
      { status: 201 },
    );

    response.cookies.set(sessionCookieName, token, getSessionCookieOptions());
    await trySendVerificationEmailForUser({
      userId: user.id,
      email: user.email,
      request,
    });

    return response;
  } catch (error) {
    logServerError("Signup failed", error);

    return signupError(error);
  }
}
