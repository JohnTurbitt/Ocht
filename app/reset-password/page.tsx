import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/PasswordResetForms";

export const metadata: Metadata = {
  title: "Set New Password - Ocht",
  description: "Set a new password for your Ocht account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordPage() {
  return (
    <main className="legal-page">
      <Link className="legal-page__back" href="/">
        Back to Ocht
      </Link>
      <p className="eyebrow">Account</p>
      <h1>Set a new password</h1>
      <p>
        Choose a new password for your Ocht account. Reset links can only be
        used once.
      </p>
      <ResetPasswordForm />
    </main>
  );
}
