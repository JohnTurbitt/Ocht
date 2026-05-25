import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, subscriptionStatusFromStripe } from "@/lib/billing";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function updateUserSubscription(
  customerId: string | null,
  status: Stripe.Subscription.Status,
) {
  if (!customerId) {
    return;
  }

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { subscription: subscriptionStatusFromStripe(status) },
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { errors: ["STRIPE_WEBHOOK_SECRET is not configured."] },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { errors: ["Stripe signature is missing."] },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch (error) {
    logServerError("Stripe webhook verification failed", error);

    return NextResponse.json(
      { errors: ["Stripe webhook signature is invalid."] },
      { status: 400 },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId =
        typeof session.customer === "string" ? session.customer : null;
      const userMatches = [
        customerId ? { stripeCustomerId: customerId } : null,
        session.client_reference_id ? { id: session.client_reference_id } : null,
      ].filter((match) => match !== null);

      if (userMatches.length === 0) {
        return NextResponse.json({ received: true });
      }

      await prisma.user.updateMany({
        where: { OR: userMatches },
        data: {
          stripeCustomerId: customerId ?? undefined,
          subscription: "ACTIVE",
        },
      });
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      await updateUserSubscription(customerId, subscription.status);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logServerError("Stripe webhook handling failed", error);

    return NextResponse.json(
      { errors: ["Stripe webhook could not be handled."] },
      { status: 500 },
    );
  }
}
