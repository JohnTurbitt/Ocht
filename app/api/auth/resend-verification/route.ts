import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { sendVerificationEmailForUser } from "@/lib/emailVerification";

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "email-verification-resend",
    limit: 4,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  try {
    const user = await requireCurrentUser(request);

    if (!user) {
      return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
    }

    const databaseUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
      },
    });

    if (!databaseUser) {
      return NextResponse.json({ errors: ["User not found."] }, { status: 404 });
    }

    if (databaseUser.emailVerifiedAt) {
      return NextResponse.json({ ok: true });
    }

    await sendVerificationEmailForUser({
      userId: databaseUser.id,
      email: databaseUser.email,
      request,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError("Email verification resend failed", error);

    return NextResponse.json(
      { errors: ["Verification email could not be sent. Try again later."] },
      { status: 503 },
    );
  }
}
