import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function sameOrigin(request: NextRequest, origin: string) {
  try {
    const requestUrl = request.nextUrl;
    const originUrl = new URL(origin);

    if (originUrl.origin === requestUrl.origin) {
      return true;
    }

    if (process.env.NODE_ENV === "development") {
      const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

      return (
        originUrl.protocol === requestUrl.protocol &&
        originUrl.port === requestUrl.port &&
        loopbackHosts.has(originUrl.hostname) &&
        loopbackHosts.has(requestUrl.hostname)
      );
    }

    return false;
  } catch {
    return false;
  }
}

export function enforceSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && sameOrigin(request, origin)) {
    return null;
  }

  const referer = request.headers.get("referer");

  if (!origin && referer && sameOrigin(request, referer)) {
    return null;
  }

  return NextResponse.json(
    { errors: ["Request origin is not allowed."] },
    { status: 403 },
  );
}

// Opportunistically sweep expired counters so the table doesn't grow forever.
// Fire-and-forget with low probability: cheap, and never on the hot path.
function maybeCleanupExpiredCounters(now: Date) {
  if (Math.random() >= 0.01) {
    return;
  }

  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  void prisma.rateLimitCounter
    .deleteMany({ where: { resetAt: { lt: staleThreshold } } })
    .catch(() => {});
}

export async function rateLimit(
  request: NextRequest,
  { key, limit, windowMs }: RateLimitOptions,
) {
  const now = new Date();
  const storeKey = `${key}:${getClientIp(request)}`;
  const nextResetAt = new Date(now.getTime() + windowMs);

  // Atomic upsert-and-increment in a single statement: if the stored window has
  // expired, reset the counter to 1 with a fresh expiry; otherwise increment in
  // place. Postgres backs this instead of an in-process Map so the limit holds
  // across multiple server instances / serverless invocations, not just one.
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitCounter" (id, key, count, "resetAt")
    VALUES (${randomUUID()}, ${storeKey}, 1, ${nextResetAt})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN "RateLimitCounter"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitCounter".count + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitCounter"."resetAt" <= ${now} THEN ${nextResetAt}
        ELSE "RateLimitCounter"."resetAt"
      END
    RETURNING count, "resetAt";
  `;

  maybeCleanupExpiredCounters(now);

  const current = rows[0];

  if (current.count > limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAt.getTime() - now.getTime()) / 1000),
    );

    return NextResponse.json(
      { errors: ["Too many requests. Try again shortly."] },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  return null;
}

export async function guardBrowserMutation(
  request: NextRequest,
  options: RateLimitOptions,
) {
  const originResponse = enforceSameOrigin(request);

  if (originResponse) {
    return originResponse;
  }

  return rateLimit(request, options);
}
