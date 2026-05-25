import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { readString } from "@/lib/apiValidation";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { hashSessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "password-reset-complete",
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const payload = await request.json().catch(() => null);
  const record = typeof payload === "object" && payload ? payload : {};
  const token = readString((record as Record<string, unknown>).token);
  const password = readString((record as Record<string, unknown>).password);

  if (!token) {
    return NextResponse.json(
      { errors: ["Password reset link is missing or invalid."] },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { errors: ["Password must be at least 8 characters."] },
      { status: 400 },
    );
  }

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date()
    ) {
      return NextResponse.json(
        { errors: ["Password reset link is expired or has already been used."] },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: await hashPassword(password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.userSession.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError("Password reset failed", error);

    return NextResponse.json(
      { errors: ["Password could not be reset. Try again later."] },
      { status: 503 },
    );
  }
}
