import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - Ocht",
  description: "How Ocht handles account, billing and race report data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" href="/">
        Back to Ocht
      </Link>
      <p className="eyebrow">Privacy</p>
      <h1>Privacy Policy</h1>
      <p>
        Ocht stores the account and race report data needed to provide saved
        reports, subscription access and race analysis features.
      </p>

      <h2>Data We Collect</h2>
      <p>
        We collect your email address, optional display name, saved report
        inputs, generated report summaries, profile defaults, session cookies
        and subscription status. Payment details are handled by Stripe and are
        not stored by Ocht.
      </p>

      <h2>How Data Is Used</h2>
      <p>
        Data is used to authenticate your account, save and load race reports,
        unlock paid report features, process subscription status and improve
        the product experience.
      </p>

      <h2>Third Parties</h2>
      <p>
        Stripe processes checkout, billing portal and subscription webhook
        events. Hosting, database, email and analytics providers may process
        operational data when Ocht is deployed. Analytics events are limited to
        product actions such as report generation, checkout starts and export
        clicks; Ocht does not intentionally send passwords, payment details,
        full race split payloads or account emails in analytics events.
        Analytics only run after you accept the cookie banner, and you can
        change that choice at any time from the &quot;Cookie preferences&quot; link in
        the footer.
      </p>

      <h2>Retention And Deletion</h2>
      <p>
        Account and report data is retained while your account exists. You can
        download a copy of your data or permanently delete your account at any
        time from the account menu. Deleting your account also cancels any
        active subscription.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy requests, email{" "}
        <a href="mailto:support@ocht.app">support@ocht.app</a>.
      </p>
      <p className="legal-page__note">
        Last updated: May 4, 2026. Replace this page with lawyer-reviewed copy
        before broad public launch.
      </p>
    </main>
  );
}
