import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact - Ocht",
  description: "Contact Ocht for support, billing and account requests.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" href="/">
        Back to Ocht
      </Link>
      <p className="eyebrow">Contact</p>
      <h1>Contact Ocht</h1>
      <p>
        For account, billing, privacy or product support, email{" "}
        <a href="mailto:support@ocht.app">support@ocht.app</a>.
      </p>

      <h2>Beta Feedback</h2>
      <p>
        For early tester feedback, use{" "}
        <a href="mailto:support@ocht.app?subject=Ocht%20beta%20feedback">
          this feedback email
        </a>
        . Include what race format you tested, whether the report felt useful
        and any calculation that looked wrong.
      </p>

      <h2>Useful Details To Include</h2>
      <p>
        Include the email on your Ocht account, what you were trying to do
        and any relevant checkout or billing context. Do not send card details.
      </p>

      <h2>Response Time</h2>
      <p>
        During early access, support is handled manually. Response times may vary
        while the product is being prepared for launch.
      </p>
    </main>
  );
}
