import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth";
import { readString } from "@/lib/apiValidation";
import { sendPasswordResetEmail } from "@/lib/email";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { createSessionToken, hashSessionToken } from "@/lib/session";

const resetTokenMaxAgeMs = 30 * 60 * 1000;

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "password-reset-request",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const payload = await request.json().catch(() => null);
  const record = typeof payload === "object" && payload ? payload : {};
  const email = normalizeEmail(readString((record as Record<string, unknown>).email));

  if (!email) {
    return NextResponse.json(
      { errors: ["Enter the email address on your Ocht account."] },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (user) {
      const token = createSessionToken();
      const resetUrl = new URL(
        `/reset-password?token=${encodeURIComponent(token)}`,
        process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin,
      );

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(Date.now() + resetTokenMaxAgeMs),
        },
      });
      await sendPasswordResetEmail({
        email: user.email,
        resetUrl: resetUrl.toString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError("Password reset request failed", error);

    return NextResponse.json(
      { errors: ["Password reset email could not be sent. Try again later."] },
      { status: 503 },
    );
  }
}
