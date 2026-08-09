import { NextRequest, NextResponse } from "next/server";
import { getStripe, sanitizeReturnPath } from "@/lib/billing";
import { billingPortalError } from "@/lib/apiErrors";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";

export async function POST(request: NextRequest) {
  const guardResponse = await guardBrowserMutation(request, {
    key: "billing-portal",
    limit: 12,
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
      select: { stripeCustomerId: true },
    });

    if (!databaseUser?.stripeCustomerId) {
      return NextResponse.json(
        { errors: ["No Stripe customer is attached to this account."] },
        { status: 400 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const body = await request.json().catch(() => null);
    const returnTo = sanitizeReturnPath(
      (body as Record<string, unknown> | null)?.returnTo,
      "/",
    );
    // Same pattern as checkout: always land on "/" so the existing sync/poll
    // logic runs, then forward on to returnTo once it settles.
    const returnParam =
      returnTo !== "/" ? `&return_to=${encodeURIComponent(returnTo)}` : "";
    const session = await getStripe().billingPortal.sessions.create({
      customer: databaseUser.stripeCustomerId,
      return_url: `${appUrl}/?checkout=billing${returnParam}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logServerError("Customer portal creation failed", error);

    return billingPortalError(error);
  }
}
