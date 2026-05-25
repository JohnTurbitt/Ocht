import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { toPublicUser } from "./profile";
import { hashSessionToken, sessionCookieName } from "./session";

export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  // Look up the hashed token instead of the cookie value. API routes only return
  // the public user fields that the client needs.
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
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
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return toPublicUser(session.user);
}

export async function requireCurrentUser(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return null;
  }

  return user;
}
