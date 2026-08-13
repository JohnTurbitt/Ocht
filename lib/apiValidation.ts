export type AuthPayload = {
  email: string;
  password: string;
  name?: string;
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

export type MePatchPayload = ProfilePayload & {
  onboardingCompleted?: boolean;
};

export function validateMePatchPayload(payload: unknown): {
  valid: boolean;
  errors: string[];
  value?: MePatchPayload;
} {
  const record = typeof payload === "object" && payload ? payload : {};
  const onboardingCompleted = (record as Record<string, unknown>).onboardingCompleted;

  const profileResult = validateProfilePayload(payload);
  if (!profileResult.valid || !profileResult.value) return profileResult;

  return {
    valid: true,
    errors: [],
    value: {
      ...profileResult.value,
      onboardingCompleted:
        typeof onboardingCompleted === "boolean" ? onboardingCompleted : undefined,
    },
  };
}

export type AdminOverrideAction = "GRANT_COMP" | "DISABLE" | "CLEAR_OVERRIDE";

export type AdminOverridePayload = {
  action: AdminOverrideAction;
  reason: string;
};

const validAdminActions: AdminOverrideAction[] = ["GRANT_COMP", "DISABLE", "CLEAR_OVERRIDE"];

export function validateAdminOverridePayload(payload: unknown): {
  valid: boolean;
  errors: string[];
  value?: AdminOverridePayload;
} {
  const record = typeof payload === "object" && payload ? payload : {};
  const action = readString((record as Record<string, unknown>).action);
  const reason = readString((record as Record<string, unknown>).reason);
  const errors: string[] = [];

  if (!validAdminActions.includes(action as AdminOverrideAction)) {
    errors.push("Choose a valid override action.");
  }

  if (!reason) {
    errors.push("A reason is required.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors,
    value: { action: action as AdminOverrideAction, reason },
  };
}
