import { NextRequest, NextResponse } from "next/server";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { hashSessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "email-verify",
    limit: 12,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const payload = await request.json().catch(() => null);
  const token =
    typeof payload === "object" && payload && "token" in payload
      ? String(payload.token ?? "").trim()
      : "";

  if (!token) {
    return NextResponse.json(
      { errors: ["Email verification link is missing or invalid."] },
      { status: 400 },
    );
  }

  try {
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt <= new Date()
    ) {
      return NextResponse.json(
        { errors: ["Email verification link is expired or has already been used."] },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError("Email verification failed", error);

    return NextResponse.json(
      { errors: ["Email could not be verified. Try again later."] },
      { status: 503 },
    );
  }
}
