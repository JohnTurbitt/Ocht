import { NextRequest, NextResponse } from "next/server";
import {
  getCheckoutPriceId,
  getStripe,
  sanitizeReturnPath,
  subscriptionStatusFromStripeSubscriptions,
} from "@/lib/billing";
import { checkoutError } from "@/lib/apiErrors";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";

export async function POST(request: NextRequest) {
  const guardResponse = await guardBrowserMutation(request, {
    key: "billing-checkout",
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

    const stripe = getStripe();
    const priceId = getCheckoutPriceId();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const body = await request.json().catch(() => null);
    const returnTo = sanitizeReturnPath(
      (body as Record<string, unknown> | null)?.returnTo,
      "/",
    );
    // Checkout always lands back on "/" first — that's the page that knows how to
    // poll and confirm the new subscription status. It then forwards on to returnTo
    // once the sync finishes, so a checkout started from Settings ends on Settings.
    const returnParam =
      returnTo !== "/" ? `&return_to=${encodeURIComponent(returnTo)}` : "";
    const databaseUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        subscription: true,
      },
    });

    if (!databaseUser) {
      return NextResponse.json({ errors: ["User not found."] }, { status: 404 });
    }

    if (databaseUser.subscription === "ACTIVE") {
      return NextResponse.json(
        { errors: ["Your account already has paid access."] },
        { status: 400 },
      );
    }

    let customerId = databaseUser.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: databaseUser.email,
        name: databaseUser.name ?? undefined,
        metadata: { userId: databaseUser.id },
      });

      customerId = customer.id;

      await prisma.user.update({
        where: { id: databaseUser.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10,
      status: "all",
    });
    const stripeSubscriptionStatus = subscriptionStatusFromStripeSubscriptions(
      existingSubscriptions.data,
    );
    const hasPaidAccess = stripeSubscriptionStatus === "ACTIVE";

    if (hasPaidAccess) {
      await prisma.user.update({
        where: { id: databaseUser.id },
        data: { subscription: stripeSubscriptionStatus },
      });

      return NextResponse.json(
        { errors: ["Your account already has paid access. Refresh the page."] },
        { status: 400 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: databaseUser.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?checkout=success${returnParam}`,
      cancel_url: `${appUrl}/?checkout=cancelled${returnParam}`,
      metadata: { userId: databaseUser.id },
      subscription_data: {
        metadata: { userId: databaseUser.id },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logServerError("Checkout creation failed", error);

    return checkoutError(error);
  }
}
