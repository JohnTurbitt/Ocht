"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { requestPasswordReset, resetPassword, verifyEmail } from "@/lib/apiClient";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await requestPasswordReset(email);
      setMessage(
        "If an Ocht account exists for that email, a reset link has been sent.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Password reset email could not be sent.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="legal-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Email</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="runner@example.com"
          type="email"
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? "Sending..." : "Send reset link"}
      </button>
      {message ? <p className="legal-form__message">{message}</p> : null}
      {error ? <p className="legal-form__error">{error}</p> : null}
    </form>
  );
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await resetPassword({ token, password });
      setMessage("Your password has been reset. You can now log in.");
      setPassword("");
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Password could not be reset.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="legal-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>New password</span>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          type="password"
        />
      </label>
      <button type="submit" disabled={submitting || !token}>
        {submitting ? "Resetting..." : "Reset password"}
      </button>
      {!token ? (
        <p className="legal-form__error">Password reset link is missing.</p>
      ) : null}
      {message ? <p className="legal-form__message">{message}</p> : null}
      {error ? <p className="legal-form__error">{error}</p> : null}
    </form>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleVerify() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await verifyEmail(token);
      setMessage("Your email has been verified. You can return to Ocht.");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Email could not be verified.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="legal-form">
      <button type="button" onClick={handleVerify} disabled={submitting || !token}>
        {submitting ? "Verifying..." : "Verify email"}
      </button>
      {!token ? (
        <p className="legal-form__error">Email verification link is missing.</p>
      ) : null}
      {message ? <p className="legal-form__message">{message}</p> : null}
      {error ? <p className="legal-form__error">{error}</p> : null}
    </div>
  );
}

export function VerifyEmailForm() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
