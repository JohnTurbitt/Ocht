export type AuthPayload = {
  email: string;
  password: string;
  name?: string;
  signupCode?: string;
};

export type ProfilePayload = {
  name?: string;
  defaultLevel: "starter" | "competitive" | "elite";
  defaultTargetTime: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validLevels = ["starter", "competitive", "elite"];
const timePattern = /^(\d{1,2}:)?[0-5]?\d:[0-5]\d$|^\d+$/;

export function readString(value: unknown) {
  // Route handlers receive unknown JSON. Normalize strings at the edge before
  // passing values into domain logic.
  return typeof value === "string" ? value.trim() : "";
}

export function validateAuthPayload(payload: unknown): {
  valid: boolean;
  errors: string[];
  value?: AuthPayload;
} {
  const record = typeof payload === "object" && payload ? payload : {};
  const email = readString((record as Record<string, unknown>).email);
  const password = readString((record as Record<string, unknown>).password);
  const name = readString((record as Record<string, unknown>).name);
  const signupCode = readString((record as Record<string, unknown>).signupCode);
  const errors: string[] = [];

  if (!emailPattern.test(email)) {
    errors.push("Enter a valid email address.");
  }

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors,
    value: {
      email,
      password,
      name: name || undefined,
      signupCode: signupCode || undefined,
    },
  };
}

export function validateProfilePayload(payload: unknown): {
  valid: boolean;
  errors: string[];
  value?: ProfilePayload;
} {
  const record = typeof payload === "object" && payload ? payload : {};
  const name = readString((record as Record<string, unknown>).name);
  const defaultLevel = readString(
    (record as Record<string, unknown>).defaultLevel,
  );
  const defaultTargetTime = readString(
    (record as Record<string, unknown>).defaultTargetTime,
  );
  const errors: string[] = [];

  if (name.length > 80) {
    errors.push("Name must be 80 characters or fewer.");
  }

  if (!validLevels.includes(defaultLevel)) {
    errors.push("Choose a valid default athlete level.");
  }

  if (!timePattern.test(defaultTargetTime)) {
    errors.push("Enter a valid default target time, for example 1:25:00.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors,
    value: {
      name: name || undefined,
      defaultLevel: defaultLevel as ProfilePayload["defaultLevel"],
      defaultTargetTime,
    },
  };
}
