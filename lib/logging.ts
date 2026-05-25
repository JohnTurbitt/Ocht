const sensitiveKeyPattern =
  /(password|pass|token|secret|authorization|cookie|session|database_url|stripe_secret_key|stripe_webhook_secret)/i;

const secretValuePatterns = [
  /sk_(test|live)_[A-Za-z0-9_]+/g,
  /pk_(test|live)_[A-Za-z0-9_]+/g,
  /whsec_[A-Za-z0-9_]+/g,
  /postgresql:\/\/[^@\s]+@/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/g,
];

function redactString(value: string) {
  return secretValuePatterns.reduce(
    (current, pattern) => current.replace(pattern, "[redacted]"),
    value,
  );
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) {
    return "[truncated]";
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key)
        ? "[redacted]"
        : sanitizeValue(entry, depth + 1),
    ]),
  );
}

export function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    const details = sanitizeValue(error) as Record<string, unknown>;

    return {
      ...details,
      name: error.name,
      message: redactString(error.message),
      stack:
        process.env.NODE_ENV === "production"
          ? undefined
          : redactString(error.stack ?? ""),
    };
  }

  return sanitizeValue(error);
}

export function logServerError(message: string, error: unknown) {
  console.error(message, sanitizeError(error));
}
