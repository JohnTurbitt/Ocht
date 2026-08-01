import { createHash, randomBytes } from "node:crypto";

export { sessionCookieName } from "./sessionCookieName";
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export function createSessionToken() {
  // The raw token only lives in the browser cookie. The database stores a hash,
  // so leaked session rows cannot be used directly as login cookies.
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getSessionExpiry(now = new Date()) {
  return new Date(now.getTime() + sessionMaxAgeSeconds * 1000);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    // Lax keeps normal in-app navigation working while blocking most cross-site
    // form posts from carrying the session cookie.
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  };
}
