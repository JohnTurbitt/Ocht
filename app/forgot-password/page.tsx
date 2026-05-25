import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/PasswordResetForms";

export const metadata: Metadata = {
  title: "Reset Password - Ocht",
  description: "Request a password reset link for your Ocht account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" href="/">
        Back to Ocht
      </Link>
      <p className="eyebrow">Account</p>
      <h1>Reset your password</h1>
      <p>
        Enter the email on your Ocht account. If an account exists, Ocht will
        send a reset link that expires in 30 minutes.
      </p>
      <ForgotPasswordForm />
    </main>
  );
}
