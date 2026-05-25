import { NextRequest } from "next/server";
import { sendEmailVerificationEmail } from "./email";
import { logServerError } from "./logging";
import { prisma } from "./prisma";
import { createSessionToken, hashSessionToken } from "./session";

const verificationTokenMaxAgeMs = 24 * 60 * 60 * 1000;

export async function sendVerificationEmailForUser({
  userId,
  email,
  request,
}: {
  userId: string;
  email: string;
  request: NextRequest;
}) {
  const token = createSessionToken();
  const verificationUrl = new URL(
    `/verify-email?token=${encodeURIComponent(token)}`,
    process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin,
  );

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + verificationTokenMaxAgeMs),
    },
  });
  await sendEmailVerificationEmail({
    email,
    verificationUrl: verificationUrl.toString(),
  });
}

export async function trySendVerificationEmailForUser(input: {
  userId: string;
  email: string;
  request: NextRequest;
}) {
  try {
    await sendVerificationEmailForUser(input);
  } catch (error) {
    logServerError("Email verification send failed", error);
  }
}
