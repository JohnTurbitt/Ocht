import { NextResponse } from "next/server";

type ApiErrorOptions = {
  status?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringProperty(value: unknown, key: string) {
  if (!isRecord(value)) {
    return "";
  }

  const property = value[key];

  return typeof property === "string" ? property : "";
}

function readNumberProperty(value: unknown, key: string) {
  if (!isRecord(value)) {
    return undefined;
  }

  const property = value[key];

  return typeof property === "number" ? property : undefined;
}

export function apiError(errors: string[], options: ApiErrorOptions = {}) {
  return NextResponse.json(
    { errors },
    { status: options.status ?? 500 },
  );
}

export function authServiceError() {
  return apiError(
    ["Account service is unavailable. Try again in a moment."],
    { status: 503 },
  );
}

export function signupError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("DATABASE_URL") ||
    message.includes("Can't reach database server") ||
    message.includes("connect ECONNREFUSED") ||
    message.includes("Connection terminated")
  ) {
    return apiError(
      ["Account service is unavailable. Try again in a moment."],
      { status: 503 },
    );
  }

  if (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("table")
  ) {
    return apiError(
      ["Account service is unavailable. Try again in a moment."],
      { status: 503 },
    );
  }

  return authServiceError();
}

export function checkoutError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const stripeType = readStringProperty(error, "type");
  const stripeCode = readStringProperty(error, "code");
  const stripeParam = readStringProperty(error, "param");
  const stripeStatus = readNumberProperty(error, "statusCode");

  if (message.includes("STRIPE_SECRET_KEY")) {
    return apiError(
      ["Payment settings are not configured yet. Contact support if you need paid access."],
      { status: 503 },
    );
  }

  if (message.includes("STRIPE_PRICE_ID")) {
    return apiError(
      ["Payment plan is not configured yet. Contact support if you need paid access."],
      { status: 503 },
    );
  }

  if (stripeCode === "resource_missing" && stripeParam.includes("price")) {
    return apiError(
      ["Checkout could not be started. Contact support if this keeps happening."],
      { status: 502 },
    );
  }

  if (stripeType === "StripeConnectionError" || stripeType === "StripeAPIError") {
    return apiError(
      ["Stripe could not be reached. Try checkout again in a moment."],
      { status: 502 },
    );
  }

  if (stripeStatus && stripeStatus >= 400 && stripeStatus < 500) {
    return apiError(
      ["Stripe rejected this checkout request. Contact support if this keeps happening."],
      { status: 502 },
    );
  }

  return apiError(
    ["Checkout could not be started. Try again or contact support if this keeps happening."],
    { status: 500 },
  );
}

export function billingPortalError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const stripeType = readStringProperty(error, "type");
  const stripeStatus = readNumberProperty(error, "statusCode");

  if (message.includes("STRIPE_SECRET_KEY")) {
    return apiError(
      ["Payment settings are not configured yet. Contact support for billing help."],
      { status: 503 },
    );
  }

  if (stripeType === "StripeConnectionError" || stripeType === "StripeAPIError") {
    return apiError(
      ["Stripe billing could not be reached. Try again in a moment."],
      { status: 502 },
    );
  }

  if (stripeStatus && stripeStatus >= 400 && stripeStatus < 500) {
    return apiError(
      ["Stripe rejected this billing portal request. Contact support if this keeps happening."],
      { status: 502 },
    );
  }

  return apiError(
    ["Billing settings could not be opened. Try again or contact support if this keeps happening."],
    { status: 500 },
  );
}
