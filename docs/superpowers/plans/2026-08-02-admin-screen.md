# Admin Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-gated `/admin` screen that lets you look up a user by email or Stripe customer id, grant or revoke a comp subscription, or disable a user's access for troubleshooting, without ever letting a routine Stripe webhook sync silently overwrite that decision.

**Architecture:** A new `subscriptionOverride` column on `User` sits alongside the existing Stripe-driven `subscription` column; a single `effectiveSubscription()` function resolves the two, and every existing gating call site keeps working unchanged because `getCurrentUser` applies that resolution before the public user object is built. Admin auth is a dedicated `requireAdmin`/`requireAdminFromCookies` guard (DB-backed `isAdmin` flag, no in-app way to grant it) that runs first in every `/admin` page render and `/api/admin/*` handler, returning the same 404 a nonexistent route would for anyone who isn't an admin. A `lib/adminUsers.ts` data-access module backs three API routes (search, detail, override) and a two-file client UI (`AdminDashboard` + `AdminUserDetail`) using the sidebar-split layout already chosen during brainstorming.

**Tech Stack:** Next.js 15 App Router (route handlers + server component page), Prisma 7 / PostgreSQL (Neon), TypeScript, Vitest, SCSS (existing token system in `styles/_base.scss`).

**Reference spec:** `docs/superpowers/specs/2026-08-02-admin-screen-design.md`

---

## Before you start

This plan assumes your local `.env` already points at a **development** Postgres database that is separate from production (confirmed during brainstorming — the user maintains distinct dev/prod databases). Every step that touches the database (migrations, the admin-grant script) runs against whichever `DATABASE_URL` is currently active. When you want admin access or a schema migration applied to **production**, you re-run the relevant command with the production `DATABASE_URL` set — that's a manual, deliberate step on the deployment host, never something this code does automatically.

---

### Task 1: Schema — `isAdmin`, `subscriptionOverride`, and the `AdminAction` audit table

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the two new enums**

In `prisma/schema.prisma`, add these two enums directly after the existing `enum SubscriptionStatus { ... }` block:

```prisma
enum SubscriptionOverride {
  COMP
  DISABLED
}

enum AdminActionType {
  GRANT_COMP
  DISABLE
  CLEAR_OVERRIDE
}
```

- [ ] **Step 2: Add fields and relations to `User`**

Replace the `model User { ... }` block with:

```prisma
model User {
  id                      String                   @id @default(cuid())
  email                   String                   @unique
  emailVerifiedAt         DateTime?
  passwordHash            String
  name                    String?
  defaultLevel            AthleteLevel             @default(COMPETITIVE)
  defaultTargetTime       String                   @default("1:25:00")
  subscription            SubscriptionStatus       @default(FREE)
  subscriptionOverride    SubscriptionOverride?
  stripeCustomerId        String?                  @unique
  onboardingCompletedAt   DateTime?
  isAdmin                 Boolean                  @default(false)
  stravaConnection        StravaConnection?
  sessions                UserSession[]
  passwordResetTokens     PasswordResetToken[]
  emailVerificationTokens EmailVerificationToken[]
  reports                 RaceReport[]
  adminActionsTaken       AdminAction[]            @relation("AdminActor")
  adminActionsReceived    AdminAction[]            @relation("AdminTarget")
  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt
}
```

- [ ] **Step 3: Add the `AdminAction` model**

Directly after the `User` model (before `model UserSession`), add:

```prisma
model AdminAction {
  id           String          @id @default(cuid())
  adminId      String
  admin        User            @relation("AdminActor", fields: [adminId], references: [id], onDelete: Cascade)
  targetUserId String
  targetUser   User            @relation("AdminTarget", fields: [targetUserId], references: [id], onDelete: Cascade)
  action       AdminActionType
  reason       String
  createdAt    DateTime        @default(now())

  @@index([targetUserId])
  @@index([adminId])
}
```

- [ ] **Step 4: Generate and apply the migration**

Run:
```bash
npx prisma migrate dev --name add_admin_and_subscription_override
```
Expected: Prisma prints `Your database is now in sync with your schema.` and creates a new folder under `prisma/migrations/` (e.g. `prisma/migrations/<timestamp>_add_admin_and_subscription_override/migration.sql`). This also regenerates the Prisma client, so `isAdmin`, `subscriptionOverride`, and `prisma.adminAction` become available in TypeScript.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add isAdmin, subscriptionOverride, and AdminAction audit table"
```

---

### Task 2: `effectiveSubscription()` — the override-vs-Stripe resolver

**Files:**
- Modify: `lib/billing.ts`
- Test: `lib/billing.test.ts`

- [ ] **Step 1: Write the failing test**

Add this `describe` block to the end of `lib/billing.test.ts` (keep the existing two `describe` blocks and the existing import line, just add `effectiveSubscription` to the import):

```ts
import { describe, expect, it } from "vitest";
import {
  effectiveSubscription,
  subscriptionStatusFromStripe,
  subscriptionStatusFromStripeSubscriptions,
} from "./billing";
```

```ts
describe("effectiveSubscription", () => {
  it("grants active access when the override is COMP, regardless of Stripe status", () => {
    expect(
      effectiveSubscription({ subscription: "FREE", subscriptionOverride: "COMP" }),
    ).toBe("ACTIVE");
    expect(
      effectiveSubscription({ subscription: "CANCELED", subscriptionOverride: "COMP" }),
    ).toBe("ACTIVE");
  });

  it("forces free access when the override is DISABLED, regardless of Stripe status", () => {
    expect(
      effectiveSubscription({ subscription: "ACTIVE", subscriptionOverride: "DISABLED" }),
    ).toBe("FREE");
    expect(
      effectiveSubscription({ subscription: "PAST_DUE", subscriptionOverride: "DISABLED" }),
    ).toBe("FREE");
  });

  it("passes through the Stripe-driven status when there is no override", () => {
    for (const status of ["FREE", "ACTIVE", "PAST_DUE", "CANCELED"] as const) {
      expect(
        effectiveSubscription({ subscription: status, subscriptionOverride: null }),
      ).toBe(status);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/billing.test.ts`
Expected: FAIL — `effectiveSubscription is not exported from "./billing"` (or similar import error).

- [ ] **Step 3: Implement `effectiveSubscription`**

In `lib/billing.ts`, directly after the existing `export type SubscriptionStatus = ...;` line, add:

```ts
export type SubscriptionOverride = "COMP" | "DISABLED";

export function effectiveSubscription(user: {
  subscription: SubscriptionStatus;
  subscriptionOverride: SubscriptionOverride | null;
}): SubscriptionStatus {
  if (user.subscriptionOverride === "COMP") {
    return "ACTIVE";
  }

  if (user.subscriptionOverride === "DISABLED") {
    return "FREE";
  }

  return user.subscription;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/billing.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add lib/billing.ts lib/billing.test.ts
git commit -m "feat: add effectiveSubscription to resolve Stripe status vs admin override"
```

---

### Task 3: Admin auth guard + wiring the override into `getCurrentUser`

**Files:**
- Modify: `lib/apiAuth.ts`
- Test: `lib/apiAuth.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `lib/apiAuth.test.ts`:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import { getCurrentUser, requireAdmin } from "./apiAuth";

vi.mock("./prisma", () => ({
  prisma: {
    userSession: {
      findUnique: vi.fn(),
    },
  },
}));

function requestWithSession(token?: string) {
  return new NextRequest("http://localhost/api/admin/users", {
    headers: token ? { cookie: `ocht_session=${token}` } : undefined,
  });
}

beforeEach(() => {
  vi.mocked(prisma.userSession.findUnique).mockReset();
});

describe("requireAdmin", () => {
  it("returns null when there is no session cookie", async () => {
    const admin = await requireAdmin(requestWithSession());

    expect(admin).toBeNull();
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the session is expired", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() - 1000),
      user: { id: "user_1", isAdmin: true },
    } as never);

    const admin = await requireAdmin(requestWithSession("token"));

    expect(admin).toBeNull();
  });

  it("returns null when the user is not an admin", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user_1", isAdmin: false },
    } as never);

    const admin = await requireAdmin(requestWithSession("token"));

    expect(admin).toBeNull();
  });

  it("returns the admin id for a valid admin session", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "user_1", isAdmin: true },
    } as never);

    const admin = await requireAdmin(requestWithSession("token"));

    expect(admin).toEqual({ id: "user_1" });
  });
});

describe("getCurrentUser", () => {
  it("applies a COMP override to the returned subscription", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "user_1",
        email: "runner@example.com",
        emailVerifiedAt: null,
        name: null,
        subscription: "FREE",
        subscriptionOverride: "COMP",
        defaultLevel: "COMPETITIVE",
        defaultTargetTime: "1:25:00",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    } as never);

    const user = await getCurrentUser(requestWithSession("token"));

    expect(user?.subscription).toBe("ACTIVE");
  });

  it("passes through the Stripe status when there is no override", async () => {
    vi.mocked(prisma.userSession.findUnique).mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "user_1",
        email: "runner@example.com",
        emailVerifiedAt: null,
        name: null,
        subscription: "PAST_DUE",
        subscriptionOverride: null,
        defaultLevel: "COMPETITIVE",
        defaultTargetTime: "1:25:00",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    } as never);

    const user = await getCurrentUser(requestWithSession("token"));

    expect(user?.subscription).toBe("PAST_DUE");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/apiAuth.test.ts`
Expected: FAIL — `requireAdmin is not exported from "./apiAuth"` (or similar).

- [ ] **Step 3: Implement**

Replace the full contents of `lib/apiAuth.ts` with:

```ts
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { effectiveSubscription } from "./billing";
import { prisma } from "./prisma";
import { toPublicUser } from "./profile";
import { hashSessionToken, sessionCookieName } from "./session";

export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  // Look up the hashed token instead of the cookie value. API routes only return
  // the public user fields that the client needs.
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true,
          name: true,
          subscription: true,
          subscriptionOverride: true,
          defaultLevel: true,
          defaultTargetTime: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return toPublicUser({
    ...session.user,
    subscription: effectiveSubscription(session.user),
  });
}

export async function requireCurrentUser(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    return null;
  }

  return user;
}

export type AdminSession = {
  id: string;
};

async function loadAdminSession(token: string | undefined): Promise<AdminSession | null> {
  if (!token) {
    return null;
  }

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        select: { id: true, isAdmin: true },
      },
    },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isAdmin) {
    return null;
  }

  return { id: session.user.id };
}

// Used by /api/admin/* route handlers.
export async function requireAdmin(request: NextRequest): Promise<AdminSession | null> {
  const token = request.cookies.get(sessionCookieName)?.value;

  return loadAdminSession(token);
}

// Used by the /admin server component page, which reads cookies via next/headers
// instead of a NextRequest.
export async function requireAdminFromCookies(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  return loadAdminSession(token);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/apiAuth.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full suite to catch any regression in existing callers**

Run: `npx vitest run`
Expected: PASS — in particular `app/api/auth/me/route.test.ts` (which mocks `@/lib/apiAuth` entirely, so it's unaffected) and any other file importing `getCurrentUser`/`requireCurrentUser`.

- [ ] **Step 6: Commit**

```bash
git add lib/apiAuth.ts lib/apiAuth.test.ts
git commit -m "feat: add requireAdmin guard and apply subscription override in getCurrentUser"
```

---

### Task 4: Validate the override request payload

**Files:**
- Modify: `lib/apiValidation.ts`
- Test: `lib/apiValidation.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/apiValidation.test.ts` (add `validateAdminOverridePayload` to the existing import line, then add this `describe` block at the end of the file):

```ts
describe("validateAdminOverridePayload", () => {
  it("normalizes a valid override payload", () => {
    const result = validateAdminOverridePayload({
      action: "GRANT_COMP",
      reason: "  beta tester  ",
    });

    expect(result.valid).toBe(true);
    expect(result.value).toEqual({
      action: "GRANT_COMP",
      reason: "beta tester",
    });
  });

  it("rejects an invalid action", () => {
    const result = validateAdminOverridePayload({
      action: "DELETE_USER",
      reason: "not a real action",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["Choose a valid override action."]);
  });

  it("rejects a blank reason", () => {
    const result = validateAdminOverridePayload({
      action: "DISABLE",
      reason: "   ",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(["A reason is required."]);
  });

  it("reports both errors when action and reason are both invalid", () => {
    const result = validateAdminOverridePayload({});

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "Choose a valid override action.",
      "A reason is required.",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/apiValidation.test.ts`
Expected: FAIL — `validateAdminOverridePayload is not exported from "./apiValidation"`.

- [ ] **Step 3: Implement**

Add to the end of `lib/apiValidation.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/apiValidation.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/apiValidation.ts lib/apiValidation.test.ts
git commit -m "feat: validate admin subscription-override request payloads"
```

---

### Task 5: `lib/adminUsers.ts` — data access for search, detail, and override

**Files:**
- Create: `lib/adminUsers.ts`
- Test: `lib/adminUsers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/adminUsers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import { applyAdminOverride, loadAdminUserDetail, searchAdminUsers } from "./adminUsers";

vi.mock("./prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    adminAction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(prisma.user.findMany).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
  vi.mocked(prisma.user.update).mockReset();
  vi.mocked(prisma.adminAction.create).mockReset();
  vi.mocked(prisma.$transaction).mockReset();
});

describe("searchAdminUsers", () => {
  it("returns nothing for a blank query without hitting the database", async () => {
    const results = await searchAdminUsers("   ");

    expect(results).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("matches by exact stripeCustomerId when the query looks like one", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user_1",
        email: "jane@example.com",
        name: "Jane Doe",
        subscription: "ACTIVE",
        subscriptionOverride: null,
        stripeCustomerId: "cus_123",
      },
    ] as never);

    const results = await searchAdminUsers("cus_123");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeCustomerId: "cus_123" } }),
    );
    expect(results).toEqual([
      {
        id: "user_1",
        email: "jane@example.com",
        name: "Jane Doe",
        subscription: "ACTIVE",
        stripeCustomerId: "cus_123",
      },
    ]);
  });

  it("matches by partial email otherwise, and applies the override to the summary", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user_1",
        email: "jane@example.com",
        name: "Jane Doe",
        subscription: "FREE",
        subscriptionOverride: "COMP",
        stripeCustomerId: null,
      },
    ] as never);

    const results = await searchAdminUsers("jane");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { contains: "jane", mode: "insensitive" } },
      }),
    );
    expect(results[0].subscription).toBe("ACTIVE");
  });
});

describe("loadAdminUserDetail", () => {
  it("returns null when the user does not exist", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const detail = await loadAdminUserDetail("missing_user");

    expect(detail).toBeNull();
  });

  it("maps a found user into the detail shape, applying the override", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "jane@example.com",
      name: "Jane Doe",
      subscription: "ACTIVE",
      subscriptionOverride: "DISABLED",
      stripeCustomerId: "cus_123",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      emailVerifiedAt: new Date("2026-06-02T00:00:00.000Z"),
      onboardingCompletedAt: null,
      stravaConnection: {
        connectedAt: new Date("2026-06-03T00:00:00.000Z"),
        revokedAt: null,
      },
      _count: { reports: 3 },
      reports: [{ createdAt: new Date("2026-07-01T00:00:00.000Z") }],
      adminActionsReceived: [
        {
          id: "action_1",
          action: "DISABLE",
          reason: "investigating a chargeback",
          createdAt: new Date("2026-07-02T00:00:00.000Z"),
          admin: { email: "you@example.com" },
        },
      ],
    } as never);

    const detail = await loadAdminUserDetail("user_1");

    expect(detail).toEqual({
      id: "user_1",
      email: "jane@example.com",
      name: "Jane Doe",
      subscription: "FREE",
      stripeSubscription: "ACTIVE",
      subscriptionOverride: "DISABLED",
      stripeCustomerId: "cus_123",
      createdAt: "2026-06-01T00:00:00.000Z",
      emailVerified: true,
      onboardingCompleted: false,
      strava: {
        connected: true,
        connectedAt: "2026-06-03T00:00:00.000Z",
        revoked: false,
      },
      reportCount: 3,
      lastReportAt: "2026-07-01T00:00:00.000Z",
      actions: [
        {
          id: "action_1",
          action: "DISABLE",
          reason: "investigating a chargeback",
          createdAt: "2026-07-02T00:00:00.000Z",
          adminEmail: "you@example.com",
        },
      ],
    });
  });
});

describe("applyAdminOverride", () => {
  it("writes the COMP override and an audit row, then returns refreshed detail", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "jane@example.com",
      name: null,
      subscription: "FREE",
      subscriptionOverride: "COMP",
      stripeCustomerId: null,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      emailVerifiedAt: null,
      onboardingCompletedAt: null,
      stravaConnection: null,
      _count: { reports: 0 },
      reports: [],
      adminActionsReceived: [],
    } as never);

    const detail = await applyAdminOverride({
      adminId: "admin_1",
      targetUserId: "user_1",
      action: "GRANT_COMP",
      reason: "beta tester",
    });

    expect(prisma.$transaction).toHaveBeenCalledWith([
      prisma.user.update({
        where: { id: "user_1" },
        data: { subscriptionOverride: "COMP" },
      }),
      prisma.adminAction.create({
        data: {
          adminId: "admin_1",
          targetUserId: "user_1",
          action: "GRANT_COMP",
          reason: "beta tester",
        },
      }),
    ]);
    expect(detail?.subscriptionOverride).toBe("COMP");
  });

  it("clears the override by writing null", async () => {
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "jane@example.com",
      name: null,
      subscription: "ACTIVE",
      subscriptionOverride: null,
      stripeCustomerId: null,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      emailVerifiedAt: null,
      onboardingCompletedAt: null,
      stravaConnection: null,
      _count: { reports: 0 },
      reports: [],
      adminActionsReceived: [],
    } as never);

    await applyAdminOverride({
      adminId: "admin_1",
      targetUserId: "user_1",
      action: "CLEAR_OVERRIDE",
      reason: "resolved",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { subscriptionOverride: null },
    });
  });
});
```

Note: `prisma.user.update(...)` and `prisma.adminAction.create(...)` are called both inside `applyAdminOverride` (to build the transaction array) and inside the test's assertion — since both are `vi.fn()` mocks returning `undefined` by default, calling them again in the assertion just re-invokes the mock harmlessly and lets us assert `toHaveBeenCalledWith` against the same shape `$transaction` received. This matches how the codebase already asserts calls with computed arguments elsewhere (see `expect(prisma.user.delete).toHaveBeenCalledWith(...)` in `app/api/auth/me/route.test.ts`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/adminUsers.test.ts`
Expected: FAIL — `Cannot find module './adminUsers'`.

- [ ] **Step 3: Implement**

Create `lib/adminUsers.ts`:

```ts
import { effectiveSubscription, SubscriptionOverride, SubscriptionStatus } from "./billing";
import { prisma } from "./prisma";

export type AdminOverrideAction = "GRANT_COMP" | "DISABLE" | "CLEAR_OVERRIDE";

export type AdminActionEntry = {
  id: string;
  action: AdminOverrideAction;
  reason: string;
  createdAt: string;
  adminEmail: string;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  subscription: SubscriptionStatus;
  stripeCustomerId: string | null;
};

export type AdminUserDetail = AdminUserSummary & {
  createdAt: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  stripeSubscription: SubscriptionStatus;
  subscriptionOverride: SubscriptionOverride | null;
  strava: { connected: boolean; connectedAt: string | null; revoked: boolean } | null;
  reportCount: number;
  lastReportAt: string | null;
  actions: AdminActionEntry[];
};

const userSummarySelect = {
  id: true,
  email: true,
  name: true,
  subscription: true,
  subscriptionOverride: true,
  stripeCustomerId: true,
} as const;

export async function searchAdminUsers(query: string): Promise<AdminUserSummary[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const users = trimmed.startsWith("cus_")
    ? await prisma.user.findMany({
        where: { stripeCustomerId: trimmed },
        select: userSummarySelect,
        take: 20,
      })
    : await prisma.user.findMany({
        where: { email: { contains: trimmed, mode: "insensitive" } },
        select: userSummarySelect,
        take: 20,
        orderBy: { email: "asc" },
      });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    subscription: effectiveSubscription(user),
    stripeCustomerId: user.stripeCustomerId,
  }));
}

export async function loadAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      subscription: true,
      subscriptionOverride: true,
      stripeCustomerId: true,
      createdAt: true,
      emailVerifiedAt: true,
      onboardingCompletedAt: true,
      stravaConnection: {
        select: { connectedAt: true, revokedAt: true },
      },
      _count: { select: { reports: true } },
      reports: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      adminActionsReceived: {
        select: {
          id: true,
          action: true,
          reason: true,
          createdAt: true,
          admin: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    subscription: effectiveSubscription(user),
    stripeSubscription: user.subscription,
    subscriptionOverride: user.subscriptionOverride,
    stripeCustomerId: user.stripeCustomerId,
    createdAt: user.createdAt.toISOString(),
    emailVerified: Boolean(user.emailVerifiedAt),
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    strava: user.stravaConnection
      ? {
          connected: !user.stravaConnection.revokedAt,
          connectedAt: user.stravaConnection.connectedAt.toISOString(),
          revoked: Boolean(user.stravaConnection.revokedAt),
        }
      : null,
    reportCount: user._count.reports,
    lastReportAt: user.reports[0]?.createdAt.toISOString() ?? null,
    actions: user.adminActionsReceived.map((entry) => ({
      id: entry.id,
      action: entry.action as AdminOverrideAction,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
      adminEmail: entry.admin.email,
    })),
  };
}

export async function applyAdminOverride(input: {
  adminId: string;
  targetUserId: string;
  action: AdminOverrideAction;
  reason: string;
}): Promise<AdminUserDetail | null> {
  const overrideValue: SubscriptionOverride | null =
    input.action === "GRANT_COMP" ? "COMP" : input.action === "DISABLE" ? "DISABLED" : null;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: input.targetUserId },
      data: { subscriptionOverride: overrideValue },
    }),
    prisma.adminAction.create({
      data: {
        adminId: input.adminId,
        targetUserId: input.targetUserId,
        action: input.action,
        reason: input.reason,
      },
    }),
  ]);

  return loadAdminUserDetail(input.targetUserId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/adminUsers.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/adminUsers.ts lib/adminUsers.test.ts
git commit -m "feat: add admin user search, detail, and override data access"
```

---

### Task 6: One-off script to grant or revoke admin access

**Files:**
- Create: `prisma/set-admin.ts`

- [ ] **Step 1: Write the script**

Create `prisma/set-admin.ts`:

```ts
// One-off script to grant or revoke admin access for a user by email.
// Run from the repo root: npx tsx prisma/set-admin.ts you@example.com
// Add --revoke to remove admin access instead: npx tsx prisma/set-admin.ts you@example.com --revoke
//
// This uses whichever DATABASE_URL is active in your environment. Run it once
// per database you want affected — locally against your dev database, and
// again with the production DATABASE_URL set (e.g. via `vercel env pull`)
// when you want admin access in production. There is no in-app way to grant
// admin access; this script is the only path, by design.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// `.env` is saved UTF-8 with a BOM, which process.loadEnvFile does not strip
// (see prisma.config.ts and prisma/seed-dev.ts for the same gotcha).
function loadEnvFile(path: string) {
  const envPath = join(process.cwd(), path);
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, "utf8");
  const contents = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(".env");

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email) {
    console.error("Usage: npx tsx prisma/set-admin.ts <email> [--revoke]");
    process.exit(1);
  }

  const { prisma } = await import("../lib/prisma");
  const { normalizeEmail } = await import("../lib/auth");

  const user = await prisma.user.update({
    where: { email: normalizeEmail(email) },
    data: { isAdmin: !revoke },
  });

  console.log(`${revoke ? "Revoked" : "Granted"} admin access for ${user.email}.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against your dev database for your own account**

Run: `npx tsx prisma/set-admin.ts <your-dev-account-email>`
Expected: prints `Granted admin access for <your-dev-account-email>.` If it instead throws a Prisma "record not found" error, sign up that account in the running dev app first, then re-run.

- [ ] **Step 3: Commit**

```bash
git add prisma/set-admin.ts
git commit -m "feat: add one-off script to grant or revoke admin access"
```

---

### Task 7: Keep `/admin` out of search indexes

**Files:**
- Modify: `app/robots.ts:10`

- [ ] **Step 1: Add `/admin` to the disallow list**

In `app/robots.ts`, change:

```ts
      disallow: ["/api/"],
```

to:

```ts
      disallow: ["/api/", "/admin"],
```

- [ ] **Step 2: Commit**

```bash
git add app/robots.ts
git commit -m "chore: disallow /admin in robots.txt"
```

---

### Task 8: `GET /api/admin/users` — search endpoint

**Files:**
- Create: `app/api/admin/users/route.ts`
- Test: `app/api/admin/users/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/admin/users/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/lib/apiAuth";
import { searchAdminUsers } from "@/lib/adminUsers";
import { GET } from "./route";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/adminUsers", () => ({
  searchAdminUsers: vi.fn(),
}));

function searchRequest(query: string) {
  return new NextRequest(`http://localhost/api/admin/users?query=${encodeURIComponent(query)}`);
}

beforeEach(() => {
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(searchAdminUsers).mockReset();
});

describe("GET /api/admin/users", () => {
  it("returns 404 when the caller is not an admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);

    const response = await GET(searchRequest("jane"));

    expect(response.status).toBe(404);
    expect(searchAdminUsers).not.toHaveBeenCalled();
  });

  it("returns search results for an admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin_1" });
    vi.mocked(searchAdminUsers).mockResolvedValue([
      {
        id: "user_1",
        email: "jane@example.com",
        name: "Jane Doe",
        subscription: "ACTIVE",
        stripeCustomerId: "cus_123",
      },
    ]);

    const response = await GET(searchRequest("jane"));

    expect(searchAdminUsers).toHaveBeenCalledWith("jane");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      users: [
        {
          id: "user_1",
          email: "jane@example.com",
          name: "Jane Doe",
          subscription: "ACTIVE",
          stripeCustomerId: "cus_123",
        },
      ],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/admin/users/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement**

Create `app/api/admin/users/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { searchAdminUsers } from "@/lib/adminUsers";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return NextResponse.json({}, { status: 404 });
  }

  const query = request.nextUrl.searchParams.get("query") ?? "";
  const users = await searchAdminUsers(query);

  return NextResponse.json({ users });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/api/admin/users/route.test.ts`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/users/route.ts app/api/admin/users/route.test.ts
git commit -m "feat: add admin user search API route"
```

---

### Task 9: `GET /api/admin/users/[id]` — detail endpoint

**Files:**
- Create: `app/api/admin/users/[id]/route.ts`
- Test: `app/api/admin/users/[id]/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/admin/users/[id]/route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/lib/apiAuth";
import { loadAdminUserDetail } from "@/lib/adminUsers";
import { GET } from "./route";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/adminUsers", () => ({
  loadAdminUserDetail: vi.fn(),
}));

const detailRequest = new NextRequest("http://localhost/api/admin/users/user_1");
const context = { params: Promise.resolve({ id: "user_1" }) };

const sampleDetail = {
  id: "user_1",
  email: "jane@example.com",
  name: "Jane Doe",
  subscription: "ACTIVE",
  stripeSubscription: "ACTIVE",
  subscriptionOverride: null,
  stripeCustomerId: "cus_123",
  createdAt: "2026-06-01T00:00:00.000Z",
  emailVerified: true,
  onboardingCompleted: true,
  strava: null,
  reportCount: 0,
  lastReportAt: null,
  actions: [],
} as const;

beforeEach(() => {
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(loadAdminUserDetail).mockReset();
});

describe("GET /api/admin/users/[id]", () => {
  it("returns 404 when the caller is not an admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);

    const response = await GET(detailRequest, context);

    expect(response.status).toBe(404);
    expect(loadAdminUserDetail).not.toHaveBeenCalled();
  });

  it("returns 404 with a message when the user id does not exist", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin_1" });
    vi.mocked(loadAdminUserDetail).mockResolvedValue(null);

    const response = await GET(detailRequest, context);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ errors: ["User not found."] });
  });

  it("returns the user detail for an admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin_1" });
    vi.mocked(loadAdminUserDetail).mockResolvedValue(sampleDetail as never);

    const response = await GET(detailRequest, context);

    expect(loadAdminUserDetail).toHaveBeenCalledWith("user_1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: sampleDetail });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/api/admin/users/[id]/route.test.ts"`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement**

Create `app/api/admin/users/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { loadAdminUserDetail } from "@/lib/adminUsers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);

  if (!admin) {
    return NextResponse.json({}, { status: 404 });
  }

  const { id } = await context.params;
  const user = await loadAdminUserDetail(id);

  if (!user) {
    return NextResponse.json({ errors: ["User not found."] }, { status: 404 });
  }

  return NextResponse.json({ user });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/api/admin/users/[id]/route.test.ts"`
Expected: PASS, all three tests green.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/users/[id]/route.ts" "app/api/admin/users/[id]/route.test.ts"
git commit -m "feat: add admin user detail API route"
```

---

### Task 10: `POST /api/admin/users/[id]/override` — grant, disable, clear

**Files:**
- Create: `app/api/admin/users/[id]/override/route.ts`
- Test: `app/api/admin/users/[id]/override/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/admin/users/[id]/override/route.test.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/lib/apiAuth";
import { applyAdminOverride, loadAdminUserDetail } from "@/lib/adminUsers";
import { validateAdminOverridePayload } from "@/lib/apiValidation";
import { guardBrowserMutation } from "@/lib/security";
import { POST } from "./route";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/adminUsers", () => ({
  applyAdminOverride: vi.fn(),
  loadAdminUserDetail: vi.fn(),
}));

vi.mock("@/lib/apiValidation", () => ({
  validateAdminOverridePayload: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  guardBrowserMutation: vi.fn(() => Promise.resolve(null)),
}));

const context = { params: Promise.resolve({ id: "user_1" }) };

function overrideRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/users/user_1/override", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sampleDetail = {
  id: "user_1",
  email: "jane@example.com",
  name: "Jane Doe",
  subscription: "ACTIVE",
  stripeSubscription: "FREE",
  subscriptionOverride: "COMP",
  stripeCustomerId: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  emailVerified: true,
  onboardingCompleted: true,
  strava: null,
  reportCount: 0,
  lastReportAt: null,
  actions: [],
} as const;

beforeEach(() => {
  vi.mocked(guardBrowserMutation).mockResolvedValue(null);
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(loadAdminUserDetail).mockReset();
  vi.mocked(applyAdminOverride).mockReset();
  vi.mocked(validateAdminOverridePayload).mockReset();
});

describe("POST /api/admin/users/[id]/override", () => {
  it("returns 404 when the caller is not an admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);

    const response = await POST(overrideRequest({}), context);

    expect(response.status).toBe(404);
    expect(applyAdminOverride).not.toHaveBeenCalled();
  });

  it("returns the guard response when rate limited", async () => {
    const guardResponse = NextResponse.json({ errors: ["Too many requests."] }, { status: 429 });
    vi.mocked(guardBrowserMutation).mockResolvedValue(guardResponse);

    const response = await POST(overrideRequest({}), context);

    expect(response).toBe(guardResponse);
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user does not exist", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin_1" });
    vi.mocked(loadAdminUserDetail).mockResolvedValue(null);

    const response = await POST(overrideRequest({}), context);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ errors: ["User not found."] });
    expect(applyAdminOverride).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid payload", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin_1" });
    vi.mocked(loadAdminUserDetail).mockResolvedValue(sampleDetail as never);
    vi.mocked(validateAdminOverridePayload).mockReturnValue({
      valid: false,
      errors: ["A reason is required."],
    });

    const response = await POST(overrideRequest({ action: "GRANT_COMP", reason: "" }), context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ errors: ["A reason is required."] });
    expect(applyAdminOverride).not.toHaveBeenCalled();
  });

  it("applies the override and returns refreshed detail for a valid request", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin_1" });
    vi.mocked(loadAdminUserDetail).mockResolvedValue(sampleDetail as never);
    vi.mocked(validateAdminOverridePayload).mockReturnValue({
      valid: true,
      errors: [],
      value: { action: "GRANT_COMP", reason: "beta tester" },
    });
    vi.mocked(applyAdminOverride).mockResolvedValue(sampleDetail as never);

    const response = await POST(
      overrideRequest({ action: "GRANT_COMP", reason: "beta tester" }),
      context,
    );

    expect(applyAdminOverride).toHaveBeenCalledWith({
      adminId: "admin_1",
      targetUserId: "user_1",
      action: "GRANT_COMP",
      reason: "beta tester",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: sampleDetail });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run "app/api/admin/users/[id]/override/route.test.ts"`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement**

Create `app/api/admin/users/[id]/override/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { applyAdminOverride, loadAdminUserDetail } from "@/lib/adminUsers";
import { validateAdminOverridePayload } from "@/lib/apiValidation";
import { guardBrowserMutation } from "@/lib/security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const guardResponse = await guardBrowserMutation(request, {
    key: "admin-override",
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const admin = await requireAdmin(request);

  if (!admin) {
    return NextResponse.json({}, { status: 404 });
  }

  const { id } = await context.params;
  const existing = await loadAdminUserDetail(id);

  if (!existing) {
    return NextResponse.json({ errors: ["User not found."] }, { status: 404 });
  }

  const validation = validateAdminOverridePayload(await request.json().catch(() => null));

  if (!validation.valid || !validation.value) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const user = await applyAdminOverride({
    adminId: admin.id,
    targetUserId: id,
    action: validation.value.action,
    reason: validation.value.reason,
  });

  return NextResponse.json({ user });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run "app/api/admin/users/[id]/override/route.test.ts"`
Expected: PASS, all five tests green.

- [ ] **Step 5: Commit**

```bash
git add "app/api/admin/users/[id]/override/route.ts" "app/api/admin/users/[id]/override/route.test.ts"
git commit -m "feat: add admin subscription override API route"
```

---

### Task 11: Client-side admin API wrappers

**Files:**
- Create: `lib/adminApiClient.ts`

(No test file for this task — matches existing precedent: `lib/apiClient.ts`, the equivalent wrapper module for non-admin endpoints, has no test file either. It's exercised through the components in Tasks 13–14 and verified manually in Task 16.)

- [ ] **Step 1: Implement**

Create `lib/adminApiClient.ts`:

```ts
export type AdminSubscriptionStatus = "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED";
export type AdminSubscriptionOverride = "COMP" | "DISABLED";
export type AdminOverrideAction = "GRANT_COMP" | "DISABLE" | "CLEAR_OVERRIDE";

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  subscription: AdminSubscriptionStatus;
  stripeCustomerId: string | null;
};

export type AdminActionEntry = {
  id: string;
  action: AdminOverrideAction;
  reason: string;
  createdAt: string;
  adminEmail: string;
};

export type AdminUserDetail = AdminUserSummary & {
  createdAt: string;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  stripeSubscription: AdminSubscriptionStatus;
  subscriptionOverride: AdminSubscriptionOverride | null;
  strava: { connected: boolean; connectedAt: string | null; revoked: boolean } | null;
  reportCount: number;
  lastReportAt: string | null;
  actions: AdminActionEntry[];
};

async function readAdminResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errors = Array.isArray(body.errors)
      ? body.errors
      : ["The server could not complete that request."];

    throw new Error(errors.join(" "));
  }

  return body as T;
}

export async function searchAdminUsers(query: string) {
  const response = await fetch(`/api/admin/users?query=${encodeURIComponent(query)}`);
  const body = await readAdminResponse<{ users: AdminUserSummary[] }>(response);

  return body.users;
}

export async function getAdminUserDetail(userId: string) {
  const response = await fetch(`/api/admin/users/${userId}`);
  const body = await readAdminResponse<{ user: AdminUserDetail }>(response);

  return body.user;
}

export async function submitAdminOverride(
  userId: string,
  input: { action: AdminOverrideAction; reason: string },
) {
  const response = await fetch(`/api/admin/users/${userId}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readAdminResponse<{ user: AdminUserDetail }>(response);

  return body.user;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/adminApiClient.ts
git commit -m "feat: add client-side admin API wrappers"
```

---

### Task 12: Admin styles

**Files:**
- Create: `styles/_admin.scss`
- Modify: `app/globals.scss:19`

- [ ] **Step 1: Create the stylesheet**

Create `styles/_admin.scss`:

```scss
/* ── /admin page ── */

.admin-page {
  min-height: 100vh;
  background: var(--paper);
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 clamp(20px, 5vw, 60px);
  height: 64px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 94%, transparent);
  backdrop-filter: blur(16px);
}

.admin-topbar__title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--ink);
  letter-spacing: -0.01em;
}

.admin-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  max-width: 1160px;
  margin: 0 auto;
  padding: 32px clamp(20px, 5vw, 60px);
  gap: 32px;
  align-items: start;
}

.admin-sidebar {
  position: sticky;
  top: 96px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-search-input {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 12px;
  background: var(--field);
  color: var(--ink);
  font: inherit;
}

.admin-search-input:focus {
  outline: none;
  border-color: var(--teal);
  box-shadow: 0 0 0 3px var(--focus);
}

.admin-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.admin-result:hover {
  background: var(--surface);
}

.admin-result.is-selected {
  border-color: var(--line);
  background: var(--field);
}

.admin-result__email {
  font-size: 0.88rem;
  color: var(--ink);
}

.admin-result__meta {
  font-family: var(--font-mono), var(--font-body), monospace;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.admin-empty {
  padding: 16px 4px;
  color: var(--muted);
  font-size: 0.88rem;
}

.admin-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.admin-detail__name {
  font-size: 1.2rem;
  font-weight: 800;
  color: var(--ink);
}

.admin-detail__meta {
  font-family: var(--font-mono), var(--font-body), monospace;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}

.admin-card {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel);
  padding: 16px 20px;
  display: grid;
  gap: 12px;
}

.admin-card__title {
  font-family: var(--font-mono), var(--font-body), monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.admin-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  font-size: 0.88rem;
}

.admin-row:last-child {
  border-bottom: none;
}

.admin-row__label {
  font-family: var(--font-mono), var(--font-body), monospace;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
}

.admin-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  background: var(--field);
  color: var(--muted);
}

.admin-pill--active {
  background: color-mix(in srgb, var(--lime) 15%, transparent);
  color: var(--teal);
}

.admin-pill--override {
  background: color-mix(in srgb, var(--red) 12%, transparent);
  color: var(--red);
}

.admin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-reason-label {
  display: grid;
  gap: 8px;
}

.admin-reason-input {
  width: 100%;
  min-height: 64px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--field);
  color: var(--ink);
  font: inherit;
  resize: vertical;
}

.admin-reason-input:focus {
  outline: none;
  border-color: var(--teal);
  box-shadow: 0 0 0 3px var(--focus);
}

.admin-audit-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-audit-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  font-size: 0.82rem;
  color: var(--muted);
}

.admin-audit-item:last-child {
  border-bottom: none;
}

.admin-audit-item strong {
  color: var(--ink);
  font-weight: 700;
}

.admin-error {
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--red) 40%, var(--line));
  border-radius: 8px;
  background: var(--error-soft);
  color: var(--red);
  font-size: 0.86rem;
}
```

- [ ] **Step 2: Register the partial**

In `app/globals.scss`, add a new line at the end of the file:

```scss
@use "../styles/admin";
```

- [ ] **Step 3: Verify Sass compiles**

Run: `npx next build 2>&1 | head -60`
Expected: build proceeds past the CSS compilation step without a Sass error (the build may fail later or take a while for unrelated reasons — you're only checking there's no `Error: ... _admin.scss` message). If you'd rather not wait on a full build, `npm run dev` and load any page also recompiles Sass and will surface a syntax error immediately in the terminal.

- [ ] **Step 4: Commit**

```bash
git add styles/_admin.scss app/globals.scss
git commit -m "feat: add admin screen styles"
```

---

### Task 13: `AdminUserDetail` component

**Files:**
- Create: `components/AdminUserDetail.tsx`

- [ ] **Step 1: Implement**

Create `components/AdminUserDetail.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  AdminOverrideAction,
  AdminUserDetail as AdminUserDetailData,
  getAdminUserDetail,
  submitAdminOverride,
} from "@/lib/adminApiClient";

type Props = {
  userId: string;
};

const subscriptionLabels: Record<AdminUserDetailData["subscription"], string> = {
  ACTIVE: "Active",
  CANCELED: "Canceled",
  FREE: "Free",
  PAST_DUE: "Past due",
};

const overrideLabels: Record<"COMP" | "DISABLED", string> = {
  COMP: "Comp override",
  DISABLED: "Disabled override",
};

export function AdminUserDetail({ userId }: Props) {
  const [detail, setDetail] = useState<AdminUserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState<AdminOverrideAction | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReason("");

    getAdminUserDetail(userId)
      .then((user) => {
        if (!cancelled) {
          setDetail(user);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  function handleAction(action: AdminOverrideAction) {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }

    setSubmittingAction(action);
    setError(null);

    submitAdminOverride(userId, { action, reason: reason.trim() })
      .then((user) => {
        setDetail(user);
        setReason("");
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setSubmittingAction(null);
      });
  }

  if (loading) {
    return <p className="admin-empty">Loading…</p>;
  }

  if (!detail) {
    return <p className="admin-error">{error ?? "User not found."}</p>;
  }

  return (
    <div className="admin-detail">
      <div className="admin-detail__head">
        <div>
          <div className="admin-detail__name">{detail.name ?? detail.email}</div>
          <div className="admin-detail__meta">
            {detail.email} · joined {new Date(detail.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div>
          <span
            className={
              detail.stripeSubscription === "ACTIVE"
                ? "admin-pill admin-pill--active"
                : "admin-pill"
            }
          >
            Stripe: {subscriptionLabels[detail.stripeSubscription]}
          </span>{" "}
          <span
            className={
              detail.subscriptionOverride ? "admin-pill admin-pill--override" : "admin-pill"
            }
          >
            {detail.subscriptionOverride ? overrideLabels[detail.subscriptionOverride] : "No override"}
          </span>
        </div>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-card">
        <div className="admin-card__title">Account</div>
        <div className="admin-row">
          <span className="admin-row__label">Email verified</span>
          <span>{detail.emailVerified ? "Yes" : "No"}</span>
        </div>
        <div className="admin-row">
          <span className="admin-row__label">Onboarding</span>
          <span>{detail.onboardingCompleted ? "Completed" : "Incomplete"}</span>
        </div>
        <div className="admin-row">
          <span className="admin-row__label">Strava</span>
          <span>
            {detail.strava
              ? detail.strava.revoked
                ? "Revoked"
                : `Connected · ${new Date(detail.strava.connectedAt as string).toLocaleDateString()}`
              : "Not connected"}
          </span>
        </div>
        <div className="admin-row">
          <span className="admin-row__label">Reports</span>
          <span>
            {detail.reportCount}
            {detail.lastReportAt ? ` · last ${new Date(detail.lastReportAt).toLocaleDateString()}` : ""}
          </span>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card__title">Subscription override</div>
        <div className="admin-actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={submittingAction !== null}
            onClick={() => handleAction("GRANT_COMP")}
          >
            Grant comp access
          </button>
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={submittingAction !== null}
            onClick={() => handleAction("DISABLE")}
          >
            Disable access
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={submittingAction !== null || !detail.subscriptionOverride}
            onClick={() => handleAction("CLEAR_OVERRIDE")}
          >
            Clear override
          </button>
        </div>
        <label className="admin-reason-label">
          <span className="admin-row__label">Reason (required)</span>
          <textarea
            className="admin-reason-input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Why are you making this change?"
          />
        </label>
      </div>

      <div className="admin-card">
        <div className="admin-card__title">Admin action history</div>
        {detail.actions.length === 0 ? (
          <p className="admin-empty">No admin actions yet.</p>
        ) : (
          <div className="admin-audit-list">
            {detail.actions.map((entry) => (
              <div key={entry.id} className="admin-audit-item">
                <strong>{new Date(entry.createdAt).toLocaleDateString()}</strong> — {entry.adminEmail}{" "}
                {entry.action === "GRANT_COMP" && "granted COMP"}
                {entry.action === "DISABLE" && "disabled access"}
                {entry.action === "CLEAR_OVERRIDE" && "cleared the override"}
                {" · "}
                {entry.reason}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

(No test file — matches this codebase's established posture of not unit-testing presentational/interactive components; there is no `components/*.test.tsx` file anywhere in the repo. Verified manually in Task 16.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/AdminUserDetail.tsx
git commit -m "feat: add AdminUserDetail component"
```

---

### Task 14: `AdminDashboard` component

**Files:**
- Create: `components/AdminDashboard.tsx`

- [ ] **Step 1: Implement**

Create `components/AdminDashboard.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import { AdminUserSummary, searchAdminUsers } from "@/lib/adminApiClient";
import { AdminUserDetail } from "@/components/AdminUserDetail";

export function AdminDashboard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  function handleSearch(event: FormEvent) {
    event.preventDefault();

    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    setError(null);

    searchAdminUsers(query.trim())
      .then((users) => {
        setResults(users);
        setSearched(true);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => {
        setSearching(false);
      });
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <span className="admin-topbar__title">Admin</span>
      </div>
      <div className="admin-layout">
        <div className="admin-sidebar">
          <form onSubmit={handleSearch}>
            <input
              className="admin-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search email or cus_..."
            />
          </form>
          {error && <p className="admin-error">{error}</p>}
          {searching ? (
            <p className="admin-empty">Searching…</p>
          ) : results.length > 0 ? (
            <div className="admin-results">
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className={user.id === selectedUserId ? "admin-result is-selected" : "admin-result"}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <span className="admin-result__email">{user.email}</span>
                  <span className="admin-result__meta">
                    {user.name ?? "—"}
                    {user.stripeCustomerId ? ` · ${user.stripeCustomerId}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : searched ? (
            <p className="admin-empty">No results.</p>
          ) : null}
        </div>
        <div>
          {selectedUserId ? (
            <AdminUserDetail userId={selectedUserId} />
          ) : (
            <p className="admin-empty">Select a user from the search results.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

(No test file — same rationale as Task 13.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/AdminDashboard.tsx
git commit -m "feat: add AdminDashboard component"
```

---

### Task 15: `/admin` page — the gate

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Implement**

Create `app/admin/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminFromCookies } from "@/lib/apiAuth";
import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const admin = await requireAdminFromCookies();

  if (!admin) {
    notFound();
  }

  return <AdminDashboard />;
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: add /admin page with server-side admin gating"
```

---

### Task 16: End-to-end verification

This task has no new files — it's a manual walkthrough to confirm the whole feature works together before considering it done. Run these against your local dev database (already confirmed separate from production).

- [ ] **Step 1: Run the full automated suite**

Run: `npx vitest run`
Expected: all tests pass, including every new file added in Tasks 2–10.

- [ ] **Step 2: Type-check and lint the whole project**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://127.0.0.1:3002`.

- [ ] **Step 4: Confirm non-admins get a real 404**

While signed out (or signed in as a non-admin account), visit `http://127.0.0.1:3002/admin` in a browser.
Expected: the same not-found page you'd get for any nonexistent route — no hint that `/admin` exists or what it contains.

- [ ] **Step 5: Grant yourself admin and confirm access**

Run `npx tsx prisma/set-admin.ts <your-dev-account-email>` if you haven't already (Task 6), sign in as that account in the browser, and visit `/admin` again.
Expected: the sidebar-split admin screen loads — search box on the left, "Select a user from the search results" on the right.

- [ ] **Step 6: Search and select a user**

Use one of the `prisma/seed-dev.ts` fake accounts (e.g. `alex.starter@ocht.dev`) or your own test account. Search by email in the admin sidebar.
Expected: the matching result appears in the left column; clicking it loads the detail panel on the right with account info, Strava status, report count, current override state ("No override"), and an empty admin action history.

- [ ] **Step 7: Grant a comp override and confirm it sticks**

In the detail panel, type a reason (e.g. "smoke test") and click "Grant comp access."
Expected: the panel refreshes, the override pill now reads "Comp override," and the admin action history shows one entry ("granted COMP · smoke test"). Sign in as that test user in a separate browser/incognito window (or check `/api/auth/me` for that account) and confirm `subscription` now reads `ACTIVE` even though the Stripe-driven status underneath is untouched.

- [ ] **Step 8: Confirm "Disable access" and "Clear override" both work**

From the same detail panel, enter a new reason and click "Disable access." Expected: pill changes to "Disabled override," a second audit entry appears, and that test user's effective subscription becomes `FREE` regardless of their real Stripe status. Then enter a reason and click "Clear override." Expected: pill returns to "No override," a third audit entry appears, and the user's effective subscription reverts to whatever their real `subscription` column says.

- [ ] **Step 9: Confirm the reason is actually required**

Clear the reason textarea and click any of the three action buttons.
Expected: an inline error ("A reason is required.") appears and no request succeeds (check the audit history length doesn't grow).

- [ ] **Step 10: Confirm a routine Stripe sync doesn't clobber an override**

With a test user's `subscriptionOverride` set to `COMP` (from Step 7), manually trigger `POST /api/billing/sync` for that user (or simulate a webhook event that sets their real `subscription` to `CANCELED`). Expected: the `subscription` column changes, but `subscriptionOverride` is untouched, and that user's effective subscription (via `/api/auth/me`) still reads `ACTIVE` because the override still wins. Clear the override afterward so the account returns to reflecting its real Stripe state.

- [ ] **Step 11: Stop the dev server and confirm a clean git status**

Run: `git status --short`
Expected: no uncommitted changes remain from this plan (all prior task commits already captured everything). If anything is outstanding, review it before considering the feature done.
