import { NextRequest, NextResponse } from "next/server";
import { validateProfilePayload } from "@/lib/apiValidation";
import { getCurrentUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { athleteLevelByLevel, toPublicUser } from "@/lib/profile";
import { guardBrowserMutation } from "@/lib/security";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "profile-update",
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const currentUser = await getCurrentUser(request);

  if (!currentUser) {
    return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
  }

  const validation = validateProfilePayload(await request.json().catch(() => null));

  if (!validation.valid || !validation.value) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      name: validation.value.name ?? null,
      defaultLevel: athleteLevelByLevel[validation.value.defaultLevel],
      defaultTargetTime: validation.value.defaultTargetTime,
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

  return NextResponse.json({ user: toPublicUser(user) });
}
