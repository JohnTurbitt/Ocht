import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

function getKey() {
  return Buffer.from(process.env.STRAVA_TOKEN_ENCRYPTION_KEY!, "base64");
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptToken(encrypted: string): string {
  const [ivHex, tagHex, ciphertextHex] = encrypted.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(ciphertextHex, "hex")) + decipher.final("utf8");
}

export class StravaTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StravaTokenError";
  }
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await prisma.stravaConnection.findUnique({ where: { userId } });
  if (!connection) throw new StravaTokenError("No Strava connection");

  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (connection.expiresAt > fiveMinFromNow) {
    return decryptToken(connection.accessToken);
  }

  const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: decryptToken(connection.refreshToken),
    }),
  });

  if (!res.ok) throw new StravaTokenError("Token refresh failed");

  const data = await res.json();

  await prisma.stravaConnection.update({
    where: { userId },
    data: {
      accessToken: encryptToken(data.access_token),
      refreshToken: encryptToken(data.refresh_token),
      expiresAt: new Date(data.expires_at * 1000),
    },
  });

  return data.access_token;
}
