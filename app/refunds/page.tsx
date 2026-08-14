import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refunds and Cancellation - Ocht",
  description: "How Ocht subscriptions, cancellation and refund requests work.",
  alternates: { canonical: "/refunds" },
};

export default function RefundsPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" href="/">
        Back to Ocht
      </Link>
      <p className="eyebrow">Billing</p>
      <h1>Refunds and Cancellation</h1>
      <p>
        Paid subscriptions are managed through Stripe. Signed-in customers can
        open the billing portal from the account panel to cancel or manage their
        subscription.
      </p>

      <h2>Cancellation</h2>
      <p>
        You can cancel through the Stripe billing portal. Access remains tied to
        the subscription status Stripe sends to Ocht through webhook events.
      </p>

      <h2>Refund Requests</h2>
      <p>
        If you believe a payment was made in error, contact support with the
        account email and payment date. Refunds are reviewed case by case.
      </p>

      <h2>Billing Problems</h2>
      <p>
        If payment fails or becomes past due, Stripe may retry payment and
        Ocht may restrict paid features until the subscription is active
        again.
      </p>

      <h2>Contact</h2>
      <p>
        For billing help, email{" "}
        <a href="mailto:support@ocht.app">support@ocht.app</a>.
      </p>
    </main>
  );
}
