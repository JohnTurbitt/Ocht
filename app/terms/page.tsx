import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - Ocht",
  description: "Terms for using Ocht race analytics and paid reports.",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" href="/">
        Back to Ocht
      </Link>
      <p className="eyebrow">Terms</p>
      <h1>Terms of Service</h1>
      <p>
        By using Ocht, you agree to use the service responsibly and understand
        that reports are training guidance, not medical advice.
      </p>

      <h2>Race Analysis</h2>
      <p>
        Ocht uses deterministic calculations based on the splits and targets
        you enter. Results are estimates and should be interpreted alongside
        your own coaching, recovery, health and race context.
      </p>

      <h2>Accounts</h2>
      <p>
        You are responsible for keeping your login details secure. Do not use
        another person&apos;s account or attempt to access reports that are not
        yours.
      </p>

      <h2>Paid Features</h2>
      <p>
        Ocht premium unlocks full report sections, export actions, saved account
        workflows and related premium features shown in the product. Billing is
        processed by Stripe.
      </p>

      <h2>Availability</h2>
      <p>
        Ocht may change as features are improved. We aim to keep the service
        available, but downtime, maintenance or third-party outages can happen.
      </p>

      <h2>Contact</h2>
      <p>
        For terms questions, email{" "}
        <a href="mailto:support@ocht.app">support@ocht.app</a>.
      </p>
      <p className="legal-page__note">
        Last updated: May 4, 2026. Replace this page with lawyer-reviewed copy
        before broad public launch.
      </p>
    </main>
  );
}
