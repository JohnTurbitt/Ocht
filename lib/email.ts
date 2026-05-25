import { Resend } from "resend";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(apiKey);
}

export function getEmailFrom() {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error("EMAIL_FROM is not configured.");
  }

  return from;
}

export async function sendPasswordResetEmail({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}) {
  const result = await getResend().emails.send({
    from: getEmailFrom(),
    to: email,
    subject: "Reset your Ocht password",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #10130f;">
        <h1 style="font-size: 22px;">Reset your Ocht password</h1>
        <p>Use the link below to set a new password for your Ocht account.</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 16px; background: #10130f; color: #c8ff2e; text-decoration: none; font-weight: 700;">
            Reset password
          </a>
        </p>
        <p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>
      </div>
    `,
    text: `Reset your Ocht password: ${resetUrl}\n\nThis link expires in 30 minutes. If you did not request it, you can ignore this email.`,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function sendEmailVerificationEmail({
  email,
  verificationUrl,
}: {
  email: string;
  verificationUrl: string;
}) {
  const result = await getResend().emails.send({
    from: getEmailFrom(),
    to: email,
    subject: "Verify your Ocht email",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #10130f;">
        <h1 style="font-size: 22px;">Verify your Ocht email</h1>
        <p>Confirm this email address so Ocht can send account, password reset, and billing-related messages reliably.</p>
        <p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 12px 16px; background: #10130f; color: #c8ff2e; text-decoration: none; font-weight: 700;">
            Verify email
          </a>
        </p>
        <p>This link expires in 24 hours. If you did not create an Ocht account, you can ignore this email.</p>
      </div>
    `,
    text: `Verify your Ocht email: ${verificationUrl}\n\nThis link expires in 24 hours. If you did not create an Ocht account, you can ignore this email.`,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}
