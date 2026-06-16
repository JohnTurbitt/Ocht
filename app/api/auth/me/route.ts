import { NextRequest, NextResponse } from "next/server";
import { validateMePatchPayload } from "@/lib/apiValidation";
import { getCurrentUser, requireCurrentUser } from "@/lib/apiAuth";
import { getStripe } from "@/lib/billing";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { athleteLevelByLevel, toPublicUser } from "@/lib/profile";
import { guardBrowserMutation } from "@/lib/security";
import { sessionCookieName } from "@/lib/session";

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

  const validation = validateMePatchPayload(await request.json().catch(() => null));

  if (!validation.valid || !validation.value) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      name: validation.value.name ?? null,
      defaultLevel: athleteLevelByLevel[validation.value.defaultLevel],
      defaultTargetTime: validation.value.defaultTargetTime,
      ...(validation.value.onboardingCompleted === true
        ? { onboardingCompletedAt: new Date() }
        : {}),
    },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      name: true,
      subscription: true,
      defaultLevel: true,
      defaultTargetTime: true,
      onboardingCompletedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user: toPublicUser(user) });
}

export async function DELETE(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "account-delete",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const currentUser = await requireCurrentUser(request);

  if (!currentUser) {
    return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
  }

  try {
    const databaseUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { stripeCustomerId: true },
    });

    if (databaseUser?.stripeCustomerId) {
      try {
        const subscriptions = await getStripe().subscriptions.list({
          customer: databaseUser.stripeCustomerId,
          status: "all",
        });

        await Promise.all(
          subscriptions.data
            .filter((subscription) => subscription.status !== "canceled")
            .map((subscription) => getStripe().subscriptions.cancel(subscription.id)),
        );
      } catch (error) {
        logServerError(
          "Stripe subscription cancellation failed during account deletion",
          error,
        );
      }
    }

    await prisma.user.delete({ where: { id: currentUser.id } });

    const response = NextResponse.json({ ok: true });

    response.cookies.delete(sessionCookieName);

    return response;
  } catch (error) {
    logServerError("Account deletion failed", error);

    return NextResponse.json(
      { errors: ["Your account could not be deleted."] },
      { status: 500 },
    );
  }
}
