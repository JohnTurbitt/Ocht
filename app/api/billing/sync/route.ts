import { NextRequest, NextResponse } from "next/server";
import {
  getStripe,
  subscriptionStatusFromStripeSubscriptions,
} from "@/lib/billing";
import { checkoutError } from "@/lib/apiErrors";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { toPublicUser } from "@/lib/profile";
import { guardBrowserMutation } from "@/lib/security";

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "billing-sync",
    limit: 8,
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
        stripeCustomerId: true,
      },
    });

    if (!databaseUser?.stripeCustomerId) {
      return NextResponse.json(
        { errors: ["No Stripe customer is attached to this account yet."] },
        { status: 400 },
      );
    }

    const subscriptions = await getStripe().subscriptions.list({
      customer: databaseUser.stripeCustomerId,
      limit: 10,
      status: "all",
    });
    const subscription = subscriptionStatusFromStripeSubscriptions(
      subscriptions.data,
    );
    const updatedUser = await prisma.user.update({
      where: { id: databaseUser.id },
      data: { subscription },
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

    return NextResponse.json({ user: toPublicUser(updatedUser) });
  } catch (error) {
    logServerError("Billing status sync failed", error);

    return checkoutError(error);
  }
}
