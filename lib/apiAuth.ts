import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { effectiveSubscription } from "./billing";
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
          subscriptionOverride: true,
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

  return toPublicUser({
    ...session.user,
    subscription: effectiveSubscription(session.user),
  });
}

export async function requireCurrentUser(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return null;
  }

  return user;
}

export type AdminSession = {
  id: string;
};

async function loadAdminSession(token: string | undefined): Promise<AdminSession | null> {
  if (!token) {
    return null;
  }

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        select: { id: true, isAdmin: true },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isAdmin) {
    return null;
  }

  return { id: session.user.id };
}

// Used by /api/admin/* route handlers.
export async function requireAdmin(request: NextRequest): Promise<AdminSession | null> {
  const token = request.cookies.get(sessionCookieName)?.value;

  return loadAdminSession(token);
}

// Used by the /admin server component page, which reads cookies via next/headers
// instead of a NextRequest.
export async function requireAdminFromCookies(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  return loadAdminSession(token);
}
