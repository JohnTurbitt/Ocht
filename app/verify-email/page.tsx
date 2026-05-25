import type { Metadata } from "next";
import Link from "next/link";
import { VerifyEmailForm } from "@/components/PasswordResetForms";

export const metadata: Metadata = {
  title: "Verify Email - Ocht",
  description: "Verify the email address on your Ocht account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyEmailPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" href="/">
        Back to Ocht
      </Link>
      <p className="eyebrow">Account</p>
      <h1>Verify your email</h1>
      <p>
        Confirm your email address so account recovery and important account
        messages work reliably.
      </p>
      <VerifyEmailForm />
    </main>
  );
}
