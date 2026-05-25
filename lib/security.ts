import { NextRequest, NextResponse } from "next/server";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

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

export function rateLimit(
  request: NextRequest,
  { key, limit, windowMs }: RateLimitOptions,
) {
  const now = Date.now();
  const storeKey = `${key}:${getClientIp(request)}`;
  const current = rateLimitStore.get(storeKey);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(storeKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return null;
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
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

  current.count += 1;
  rateLimitStore.set(storeKey, current);

  return null;
}

export function guardBrowserMutation(
  request: NextRequest,
  options: RateLimitOptions,
) {
  return enforceSameOrigin(request) ?? rateLimit(request, options);
}
