# Strava Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Ocht to Strava via OAuth 2.0, compute derived training metrics from activity history, and offer the connection during goal-first onboarding.

**Architecture:** Three layers built bottom-up: (1) token encryption + Strava API client, (2) pure-function metrics computation + background sync service, (3) API routes and UI components. All Strava-derived data lives in two separate DB tables so it can be deleted cleanly on disconnection without touching the User or RaceReport records.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma + Neon Postgres, Vitest, Node `crypto` (AES-256-GCM), SCSS

**Spec:** `docs/superpowers/specs/2026-06-16-strava-integration-design.md`

---

## File Map

| File | Action |
|---|---|
| `prisma/schema.prisma` | Modify — add `StravaConnection`, `StravaProfile` models; add `onboardingCompletedAt`, `stravaConnection` to `User` |
| `lib/stravaTypes.ts` | Create — `StravaActivity`, `StravaAthlete`, `StravaTokenResponse` interfaces |
| `lib/stravaTokens.ts` | Create — `encryptToken`, `decryptToken`, `getValidAccessToken`, `StravaTokenError` |
| `lib/stravaTokens.test.ts` | Create — tests for encrypt/decrypt roundtrip and token refresh logic |
| `lib/stravaClient.ts` | Create — `getAthlete`, `getActivities` |
| `lib/stravaClient.test.ts` | Create — tests for Authorization header and paginated fetch |
| `lib/stravaMetrics.ts` | Create — `computeTrainingContext`, `computeBestEfforts`, `computeLTHR`, `computeCardiacDecoupling`, `computeTrainingLoad`, `computePaceZones` |
| `lib/stravaMetrics.test.ts` | Create — unit tests for all 6 functions |
| `lib/stravaSyncService.ts` | Create — `syncStravaProfile` |
| `lib/stravaSyncService.test.ts` | Create — tests for sync orchestration |
| `app/api/strava/connect/route.ts` | Create — redirect to Strava OAuth |
| `app/api/strava/connect/route.test.ts` | Create |
| `app/api/strava/callback/route.ts` | Create — OAuth callback, token exchange, upsert connection |
| `app/api/strava/callback/route.test.ts` | Create |
| `app/api/strava/status/route.ts` | Create — `GET` connection status |
| `app/api/strava/status/route.test.ts` | Create |
| `app/api/strava/sync/route.ts` | Create — `POST` trigger re-sync |
| `app/api/strava/sync/route.test.ts` | Create |
| `app/api/strava/connection/route.ts` | Create — `DELETE` disconnect |
| `app/api/strava/connection/route.test.ts` | Create |
| `app/api/auth/me/route.ts` | Modify — accept `onboardingCompleted` in PATCH |
| `lib/apiValidation.ts` | Modify — add `validateMePatchPayload` |
| `components/onboarding/GoalScreen.tsx` | Create |
| `components/onboarding/StravaConnectScreen.tsx` | Create |
| `components/onboarding/OnboardingModal.tsx` | Create |
| `components/OnboardingGate.tsx` | Create — client component, checks user state, renders OnboardingModal |
| `styles/_onboarding.scss` | Create |
| `styles/globals.scss` | Modify — import `_onboarding.scss` |
| `app/layout.tsx` | Modify — add `<OnboardingGate />` |
| `components/SettingsModal.tsx` | Modify — add Strava section to Privacy tab |

---

### Task 1: Prisma schema — StravaConnection, StravaProfile, User fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to User model and the two new models**

Open `prisma/schema.prisma`. After the `stripeCustomerId` field in `User`, add:

```prisma
  onboardingCompletedAt DateTime?
  stravaConnection      StravaConnection?
```

After the closing `}` of `RaceReport`, append:

```prisma
model StravaConnection {
  id              String         @id @default(cuid())
  userId          String         @unique
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  stravaAthleteId Int            @unique
  accessToken     String
  refreshToken    String
  expiresAt       DateTime
  scope           String
  connectedAt     DateTime       @default(now())
  revokedAt       DateTime?

  profile         StravaProfile?

  @@index([userId])
}

model StravaProfile {
  id                   String           @id @default(cuid())
  connectionId         String           @unique
  connection           StravaConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  userId               String           @unique
  lthrBpm              Int?
  cardiacDecouplingPct Float?
  ctlScore             Float?
  atlScore             Float?
  bestEffort5kSeconds  Int?
  bestEffort10kSeconds Int?
  paceZonesJson        Json?
  runsPerWeek          Float?
  weeklyDistanceKm     Float?
  longestRunKm         Float?
  hardRunsPerWeek      Float?
  restDaysPerWeek      Float?
  lastSyncedAt         DateTime
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt

  @@index([userId])
}
```

- [ ] **Step 2: Generate and apply the migration**

```bash
npx prisma migrate dev --name add-strava-tables
```

Expected: migration file created in `prisma/migrations/`, Prisma client regenerated with no errors.

- [ ] **Step 3: Verify types are generated**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add StravaConnection, StravaProfile, and onboardingCompletedAt to schema"
```

---

### Task 2: Strava types + token encryption

**Files:**
- Create: `lib/stravaTypes.ts`
- Create: `lib/stravaTokens.ts`
- Create: `lib/stravaTokens.test.ts`

- [ ] **Step 1: Create `lib/stravaTypes.ts`**

```typescript
export interface StravaActivity {
  id: number;
  type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed: number;
  start_date: string;
  suffer_score?: number;
}

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: StravaAthlete;
}
```

- [ ] **Step 2: Write the failing tests for token encryption**

Create `lib/stravaTokens.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken, getValidAccessToken, StravaTokenError } from "./stravaTokens";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stravaConnection: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.stubEnv("STRAVA_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32).toString("base64"));
vi.stubEnv("STRAVA_CLIENT_ID", "test_client_id");
vi.stubEnv("STRAVA_CLIENT_SECRET", "test_client_secret");

beforeEach(() => {
  vi.mocked(prisma.stravaConnection.findUnique).mockReset();
  vi.mocked(prisma.stravaConnection.update).mockReset();
});

describe("encryptToken / decryptToken", () => {
  it("roundtrips a token string", () => {
    const plaintext = "my_secret_access_token_abc123";
    const encrypted = encryptToken(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const a = encryptToken("same_token");
    const b = encryptToken("same_token");
    expect(a).not.toBe(b);
  });
});

describe("getValidAccessToken", () => {
  it("throws StravaTokenError when no connection exists", async () => {
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue(null);
    await expect(getValidAccessToken("user_1")).rejects.toThrow(StravaTokenError);
  });

  it("returns decrypted access token when not expired", async () => {
    const token = "valid_access_token";
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue({
      accessToken: encryptToken(token),
      refreshToken: encryptToken("refresh"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    } as never);

    const result = await getValidAccessToken("user_1");
    expect(result).toBe(token);
    expect(prisma.stravaConnection.update).not.toHaveBeenCalled();
  });

  it("refreshes and stores new tokens when expired", async () => {
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue({
      accessToken: encryptToken("old_access"),
      refreshToken: encryptToken("old_refresh"),
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    vi.mocked(prisma.stravaConnection.update).mockResolvedValue({} as never);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new_access_token",
        refresh_token: "new_refresh_token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    }) as never;

    const result = await getValidAccessToken("user_1");
    expect(result).toBe("new_access_token");
    expect(prisma.stravaConnection.update).toHaveBeenCalledOnce();
  });

  it("throws StravaTokenError when refresh request fails", async () => {
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue({
      accessToken: encryptToken("access"),
      refreshToken: encryptToken("refresh"),
      expiresAt: new Date(Date.now() - 1000),
    } as never);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as never;

    await expect(getValidAccessToken("user_1")).rejects.toThrow(StravaTokenError);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run lib/stravaTokens.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create `lib/stravaTokens.ts`**

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run lib/stravaTokens.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/stravaTypes.ts lib/stravaTokens.ts lib/stravaTokens.test.ts
git commit -m "feat: add Strava types and AES-256-GCM token encryption"
```

---

### Task 3: Strava API client

**Files:**
- Create: `lib/stravaClient.ts`
- Create: `lib/stravaClient.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/stravaClient.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActivities, getAthlete } from "./stravaClient";
import * as tokens from "./stravaTokens";

vi.mock("./stravaTokens", () => ({
  getValidAccessToken: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(tokens.getValidAccessToken).mockReset();
});

describe("getAthlete", () => {
  it("calls /athlete with Authorization header and returns JSON", async () => {
    vi.mocked(tokens.getValidAccessToken).mockResolvedValue("tok_abc");
    const athlete = { id: 1, firstname: "John", lastname: "Doe", profile: "" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => athlete,
    }) as never;

    const result = await getAthlete("user_1");

    expect(fetch).toHaveBeenCalledWith(
      "https://www.strava.com/api/v3/athlete",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok_abc" }),
      }),
    );
    expect(result).toEqual(athlete);
  });

  it("throws when Strava returns non-ok status", async () => {
    vi.mocked(tokens.getValidAccessToken).mockResolvedValue("tok_abc");
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as never;
    await expect(getAthlete("user_1")).rejects.toThrow("401");
  });
});

describe("getActivities", () => {
  it("passes perPage and after as query params", async () => {
    vi.mocked(tokens.getValidAccessToken).mockResolvedValue("tok_abc");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as never;

    await getActivities("user_1", { perPage: 200, after: 1700000000 });

    const calledUrl = (vi.mocked(fetch).mock.calls[0][0] as string);
    expect(calledUrl).toContain("per_page=200");
    expect(calledUrl).toContain("after=1700000000");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/stravaClient.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/stravaClient.ts`**

```typescript
import { getValidAccessToken } from "@/lib/stravaTokens";
import type { StravaActivity, StravaAthlete } from "@/lib/stravaTypes";

const BASE = "https://www.strava.com/api/v3";

async function stravaFetch(userId: string, path: string): Promise<Response> {
  const token = await getValidAccessToken(userId);
  return fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAthlete(userId: string): Promise<StravaAthlete> {
  const res = await stravaFetch(userId, "/athlete");
  if (!res.ok) throw new Error(`Strava athlete fetch failed: ${res.status}`);
  return res.json();
}

export async function getActivities(
  userId: string,
  opts: { perPage: number; after: number },
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: String(opts.perPage),
    after: String(opts.after),
  });
  const res = await stravaFetch(userId, `/athlete/activities?${params}`);
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/stravaClient.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/stravaClient.ts lib/stravaClient.test.ts
git commit -m "feat: add Strava API client"
```

---

### Task 4: Metrics computation

**Files:**
- Create: `lib/stravaMetrics.ts`
- Create: `lib/stravaMetrics.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/stravaMetrics.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  computeBestEfforts,
  computeCardiacDecoupling,
  computeLTHR,
  computePaceZones,
  computeTrainingContext,
  computeTrainingLoad,
} from "./stravaMetrics";
import type { StravaActivity } from "./stravaTypes";

function makeRun(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 1,
    type: "Run",
    distance: 10000,
    moving_time: 3000,
    elapsed_time: 3100,
    average_speed: 3.33,
    start_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe("computeTrainingContext", () => {
  it("returns zero metrics when no recent runs", () => {
    const result = computeTrainingContext([
      makeRun({ start_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() }),
    ]);
    expect(result.runsPerWeek).toBe(0);
    expect(result.weeklyDistanceKm).toBe(0);
  });

  it("calculates runsPerWeek over a 4-week window", () => {
    const runs = Array.from({ length: 8 }, (_, i) =>
      makeRun({ id: i, start_date: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000).toISOString() }),
    );
    const result = computeTrainingContext(runs);
    expect(result.runsPerWeek).toBe(2);
  });

  it("computes longestRunKm from max distance", () => {
    const result = computeTrainingContext([
      makeRun({ distance: 5000 }),
      makeRun({ distance: 21000 }),
      makeRun({ distance: 10000 }),
    ]);
    expect(result.longestRunKm).toBe(21);
  });
});

describe("computeBestEfforts", () => {
  it("returns null when no runs >= 3km", () => {
    const result = computeBestEfforts([makeRun({ distance: 2000 })]);
    expect(result.bestEffort5kSeconds).toBeNull();
    expect(result.bestEffort10kSeconds).toBeNull();
  });

  it("extrapolates 5k from a 10k run using Riegel formula", () => {
    const result = computeBestEfforts([makeRun({ distance: 10000, moving_time: 3000 })]);
    expect(result.bestEffort5kSeconds).toBeGreaterThan(1400);
    expect(result.bestEffort5kSeconds).toBeLessThan(1500);
  });

  it("returns the fastest projected time across multiple runs", () => {
    const fast = makeRun({ id: 1, distance: 10000, moving_time: 2400 });
    const slow = makeRun({ id: 2, distance: 10000, moving_time: 3600 });
    const result = computeBestEfforts([fast, slow]);
    expect(result.bestEffort5kSeconds).toBeLessThan(
      Math.round(3600 * Math.pow(5000 / 10000, 1.06)),
    );
  });
});

describe("computeLTHR", () => {
  it("returns null when no qualifying runs", () => {
    expect(computeLTHR([makeRun({ moving_time: 1000 })])).toBeNull();
  });

  it("returns 95% of highest average HR for qualifying runs", () => {
    const result = computeLTHR([
      makeRun({ moving_time: 2000, average_heartrate: 160 }),
      makeRun({ moving_time: 2000, average_heartrate: 170 }),
    ]);
    expect(result).toBe(Math.round(0.95 * 170));
  });
});

describe("computeCardiacDecoupling", () => {
  it("returns null with fewer than 2 long runs", () => {
    expect(
      computeCardiacDecoupling([makeRun({ moving_time: 3700, average_heartrate: 150 })]),
    ).toBeNull();
  });

  it("returns a non-negative percentage with 2+ long runs", () => {
    const runs = [
      makeRun({ id: 1, moving_time: 4000, average_heartrate: 150, average_speed: 3.0 }),
      makeRun({ id: 2, moving_time: 5000, average_heartrate: 165, average_speed: 2.8 }),
    ];
    const result = computeCardiacDecoupling(runs);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe("computeTrainingLoad", () => {
  it("returns 0 CTL and ATL with no runs", () => {
    const result = computeTrainingLoad([]);
    expect(result.ctlScore).toBe(0);
    expect(result.atlScore).toBe(0);
  });

  it("ATL responds faster than CTL to recent load", () => {
    const runs = Array.from({ length: 5 }, (_, i) =>
      makeRun({
        id: i,
        start_date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        moving_time: 3600,
        average_heartrate: 155,
      }),
    );
    const { ctlScore, atlScore } = computeTrainingLoad(runs);
    expect(atlScore).toBeGreaterThan(ctlScore);
  });
});

describe("computePaceZones", () => {
  it("returns null when bestEffort5kSeconds is null", () => {
    expect(computePaceZones(null)).toBeNull();
  });

  it("returns 5 zones with descending minPaceSec from z1 to z4", () => {
    const zones = computePaceZones(1200);
    expect(zones).not.toBeNull();
    expect(zones!.z1.minPaceSec).toBeGreaterThan(zones!.z2.minPaceSec);
    expect(zones!.z2.minPaceSec).toBeGreaterThan(zones!.z3.minPaceSec);
    expect(zones!.z3.minPaceSec).toBeGreaterThan(zones!.z4.minPaceSec);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/stravaMetrics.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/stravaMetrics.ts`**

```typescript
import type { StravaActivity } from "@/lib/stravaTypes";

export interface TrainingContextMetrics {
  runsPerWeek: number;
  weeklyDistanceKm: number;
  longestRunKm: number;
  hardRunsPerWeek: number;
  restDaysPerWeek: number;
}

export interface BestEffortMetrics {
  bestEffort5kSeconds: number | null;
  bestEffort10kSeconds: number | null;
}

export interface TrainingLoadMetrics {
  ctlScore: number;
  atlScore: number;
}

export interface PaceZone {
  minPaceSec: number;
  maxPaceSec: number;
}

export interface PaceZones {
  z1: PaceZone;
  z2: PaceZone;
  z3: PaceZone;
  z4: PaceZone;
  z5: PaceZone;
}

export function computeTrainingContext(activities: StravaActivity[]): TrainingContextMetrics {
  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const runs = activities.filter(
    (a) => a.type === "Run" && new Date(a.start_date).getTime() > cutoff,
  );

  if (runs.length === 0) {
    return { runsPerWeek: 0, weeklyDistanceKm: 0, longestRunKm: 0, hardRunsPerWeek: 0, restDaysPerWeek: 7 };
  }

  const totalDistanceKm = runs.reduce((sum, r) => sum + r.distance / 1000, 0);
  const longestRunKm = runs.reduce((max, r) => Math.max(max, r.distance / 1000), 0);
  const hardRuns = runs.filter((r) => (r.suffer_score ?? 0) > 50).length;
  const runDays = new Set(runs.map((r) => r.start_date.slice(0, 10))).size;

  return {
    runsPerWeek: runs.length / 4,
    weeklyDistanceKm: Math.round((totalDistanceKm / 4) * 10) / 10,
    longestRunKm: Math.round(longestRunKm * 10) / 10,
    hardRunsPerWeek: Math.round((hardRuns / 4) * 10) / 10,
    restDaysPerWeek: Math.round((7 - runDays / 4) * 10) / 10,
  };
}

function riegelExtrap(timeSec: number, distM: number, targetM: number): number {
  return timeSec * Math.pow(targetM / distM, 1.06);
}

export function computeBestEfforts(activities: StravaActivity[]): BestEffortMetrics {
  const runs = activities.filter((a) => a.type === "Run" && a.distance >= 3000);
  let best5k: number | null = null;
  let best10k: number | null = null;

  for (const run of runs) {
    const p5k = riegelExtrap(run.moving_time, run.distance, 5000);
    const p10k = riegelExtrap(run.moving_time, run.distance, 10000);
    if (best5k === null || p5k < best5k) best5k = p5k;
    if (best10k === null || p10k < best10k) best10k = p10k;
  }

  return {
    bestEffort5kSeconds: best5k !== null ? Math.round(best5k) : null,
    bestEffort10kSeconds: best10k !== null ? Math.round(best10k) : null,
  };
}

export function computeLTHR(activities: StravaActivity[]): number | null {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const qualifying = activities.filter(
    (a) =>
      a.type === "Run" &&
      new Date(a.start_date).getTime() > cutoff &&
      a.moving_time >= 1800 &&
      a.average_heartrate != null,
  );

  if (qualifying.length === 0) return null;

  const best = qualifying.reduce((top, a) =>
    (a.average_heartrate ?? 0) > (top.average_heartrate ?? 0) ? a : top,
  );

  return Math.round(0.95 * best.average_heartrate!);
}

export function computeCardiacDecoupling(activities: StravaActivity[]): number | null {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const longRuns = activities
    .filter(
      (a) =>
        a.type === "Run" &&
        new Date(a.start_date).getTime() > cutoff &&
        a.moving_time >= 3600 &&
        a.average_heartrate != null &&
        a.average_speed > 0,
    )
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    .slice(0, 4);

  if (longRuns.length < 2) return null;

  const couplings = longRuns.map((r) => r.average_heartrate! / r.average_speed);
  const best = Math.min(...couplings);
  const worst = Math.max(...couplings);

  return Math.round(((worst - best) / best) * 100 * 10) / 10;
}

export function computeTrainingLoad(activities: StravaActivity[]): TrainingLoadMetrics {
  const runs = activities
    .filter((a) => a.type === "Run" && a.average_heartrate != null)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const dailyStress: Record<string, number> = {};
  for (const run of runs) {
    const day = run.start_date.slice(0, 10);
    const stress = (run.moving_time / 60) * run.average_heartrate! / 100;
    dailyStress[day] = (dailyStress[day] ?? 0) + stress;
  }

  const now = Date.now();
  let ctl = 0;
  let atl = 0;

  for (let i = 89; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const stress = dailyStress[d] ?? 0;
    ctl = ctl + (1 / 42) * (stress - ctl);
    atl = atl + (1 / 7) * (stress - atl);
  }

  return {
    ctlScore: Math.round(ctl * 10) / 10,
    atlScore: Math.round(atl * 10) / 10,
  };
}

export function computePaceZones(bestEffort5kSeconds: number | null): PaceZones | null {
  if (!bestEffort5kSeconds) return null;

  const pace5k = bestEffort5kSeconds / 5;

  return {
    z1: { minPaceSec: Math.round(pace5k * 1.4), maxPaceSec: 9999 },
    z2: { minPaceSec: Math.round(pace5k * 1.2), maxPaceSec: Math.round(pace5k * 1.4) - 1 },
    z3: { minPaceSec: Math.round(pace5k * 1.05), maxPaceSec: Math.round(pace5k * 1.2) - 1 },
    z4: { minPaceSec: Math.round(pace5k * 1.0), maxPaceSec: Math.round(pace5k * 1.05) - 1 },
    z5: { minPaceSec: 0, maxPaceSec: Math.round(pace5k * 1.0) - 1 },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/stravaMetrics.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/stravaMetrics.ts lib/stravaMetrics.test.ts
git commit -m "feat: add Strava metrics computation (LTHR, CTL/ATL, best efforts, pace zones)"
```

---

### Task 5: Sync service

**Files:**
- Create: `lib/stravaSyncService.ts`
- Create: `lib/stravaSyncService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/stravaSyncService.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncStravaProfile } from "./stravaSyncService";
import * as client from "./stravaClient";
import { prisma } from "@/lib/prisma";

vi.mock("./stravaClient", () => ({
  getActivities: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stravaProfile: { upsert: vi.fn() },
    stravaConnection: { findUnique: vi.fn() },
  },
}));

beforeEach(() => {
  vi.mocked(client.getActivities).mockReset();
  vi.mocked(prisma.stravaProfile.upsert).mockReset();
  vi.mocked(prisma.stravaConnection.findUnique).mockReset();
});

describe("syncStravaProfile", () => {
  it("fetches activities and upserts the profile", async () => {
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue({ id: "conn_1" } as never);
    vi.mocked(client.getActivities).mockResolvedValue([]);
    vi.mocked(prisma.stravaProfile.upsert).mockResolvedValue({} as never);

    await syncStravaProfile("user_1");

    expect(client.getActivities).toHaveBeenCalledWith(
      "user_1",
      expect.objectContaining({ perPage: 200 }),
    );
    expect(prisma.stravaProfile.upsert).toHaveBeenCalledOnce();
  });

  it("throws when no connection exists for the user", async () => {
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue(null);
    await expect(syncStravaProfile("user_1")).rejects.toThrow("No Strava connection");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/stravaSyncService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/stravaSyncService.ts`**

```typescript
import { prisma } from "@/lib/prisma";
import { getActivities } from "@/lib/stravaClient";
import {
  computeBestEfforts,
  computeCardiacDecoupling,
  computeLTHR,
  computePaceZones,
  computeTrainingContext,
  computeTrainingLoad,
} from "@/lib/stravaMetrics";

export async function syncStravaProfile(userId: string): Promise<void> {
  const connection = await prisma.stravaConnection.findUnique({ where: { userId } });
  if (!connection) throw new Error("No Strava connection");

  const after = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
  const activities = await getActivities(userId, { perPage: 200, after });

  const context = computeTrainingContext(activities);
  const bestEfforts = computeBestEfforts(activities);
  const lthrBpm = computeLTHR(activities);
  const cardiacDecouplingPct = computeCardiacDecoupling(activities);
  const load = computeTrainingLoad(activities);
  const paceZones = computePaceZones(bestEfforts.bestEffort5kSeconds);

  await prisma.stravaProfile.upsert({
    where: { connectionId: connection.id },
    create: {
      connectionId: connection.id,
      userId,
      lthrBpm,
      cardiacDecouplingPct,
      ctlScore: load.ctlScore,
      atlScore: load.atlScore,
      bestEffort5kSeconds: bestEfforts.bestEffort5kSeconds,
      bestEffort10kSeconds: bestEfforts.bestEffort10kSeconds,
      paceZonesJson: paceZones,
      runsPerWeek: context.runsPerWeek,
      weeklyDistanceKm: context.weeklyDistanceKm,
      longestRunKm: context.longestRunKm,
      hardRunsPerWeek: context.hardRunsPerWeek,
      restDaysPerWeek: context.restDaysPerWeek,
      lastSyncedAt: new Date(),
    },
    update: {
      lthrBpm,
      cardiacDecouplingPct,
      ctlScore: load.ctlScore,
      atlScore: load.atlScore,
      bestEffort5kSeconds: bestEfforts.bestEffort5kSeconds,
      bestEffort10kSeconds: bestEfforts.bestEffort10kSeconds,
      paceZonesJson: paceZones,
      runsPerWeek: context.runsPerWeek,
      weeklyDistanceKm: context.weeklyDistanceKm,
      longestRunKm: context.longestRunKm,
      hardRunsPerWeek: context.hardRunsPerWeek,
      restDaysPerWeek: context.restDaysPerWeek,
      lastSyncedAt: new Date(),
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/stravaSyncService.test.ts
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/stravaSyncService.ts lib/stravaSyncService.test.ts
git commit -m "feat: add Strava sync service"
```

---

### Task 6: OAuth connect + callback routes

**Files:**
- Create: `app/api/strava/connect/route.ts` + test
- Create: `app/api/strava/callback/route.ts` + test

- [ ] **Step 1: Write failing test for connect route**

Create `app/api/strava/connect/route.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import * as apiAuth from "@/lib/apiAuth";

vi.mock("@/lib/apiAuth", () => ({ getCurrentUser: vi.fn() }));
vi.stubEnv("STRAVA_CLIENT_ID", "test_client_id");
vi.stubEnv("STRAVA_CLIENT_SECRET", "test_secret");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

function req() {
  return new NextRequest("http://localhost/api/strava/connect");
}

describe("GET /api/strava/connect", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
  });

  it("redirects to Strava OAuth URL with correct params", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    const res = await GET(req());
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("https://www.strava.com/oauth/authorize");
    expect(location).toContain("client_id=test_client_id");
    expect(location).toContain("activity%3Aread_all");
    expect(location).toContain("state=");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run app/api/strava/connect/route.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Create `app/api/strava/connect/route.ts`**

```typescript
import { createHmac, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/apiAuth";

function buildStateToken(userId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}:${Date.now()}:${nonce}`;
  const sig = createHmac("sha256", process.env.STRAVA_CLIENT_SECRET!)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const state = buildStateToken(user.id);

  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", process.env.STRAVA_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${appUrl}/api/strava/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "activity:read_all,profile:read_all");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("strava_oauth_state", state, {
    httpOnly: true,
    maxAge: 5 * 60,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
```

- [ ] **Step 4: Write failing test for callback route**

Create `app/api/strava/callback/route.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import * as apiAuth from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import * as syncService from "@/lib/stravaSyncService";

vi.mock("@/lib/apiAuth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/stravaSyncService", () => ({ syncStravaProfile: vi.fn() }));
vi.mock("@/lib/stravaTokens", () => ({ encryptToken: (t: string) => `enc:${t}` }));
vi.mock("@/lib/logging", () => ({ logServerError: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { stravaConnection: { upsert: vi.fn() } },
}));

vi.stubEnv("STRAVA_CLIENT_ID", "cid");
vi.stubEnv("STRAVA_CLIENT_SECRET", "csec");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

function callbackReq(params: Record<string, string>, stateCookie = "state_abc") {
  const url = new URL("http://localhost/api/strava/callback");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString(), {
    headers: { cookie: `strava_oauth_state=${stateCookie}` },
  });
}

beforeEach(() => {
  vi.mocked(apiAuth.getCurrentUser).mockReset();
  vi.mocked(prisma.stravaConnection.upsert).mockReset();
  vi.mocked(syncService.syncStravaProfile).mockReset();
});

describe("GET /api/strava/callback", () => {
  it("returns 400 when state cookie does not match query param", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    const res = await GET(callbackReq({ code: "abc", state: "different", scope: "activity:read_all" }, "state_abc"));
    expect(res.status).toBe(400);
  });

  it("redirects to /?strava=insufficient_scope when scope missing activity:read_all", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    const res = await GET(callbackReq({ code: "abc", state: "state_abc", scope: "profile:read_all" }));
    expect(res.headers.get("location")).toContain("strava=insufficient_scope");
  });

  it("upserts connection, triggers sync, and redirects on success", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    vi.mocked(prisma.stravaConnection.upsert).mockResolvedValue({} as never);
    vi.mocked(syncService.syncStravaProfile).mockResolvedValue();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "acc",
        refresh_token: "ref",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        athlete: { id: 99 },
      }),
    }) as never;

    const res = await GET(
      callbackReq({ code: "code", state: "state_abc", scope: "activity:read_all,profile:read_all" }),
    );

    expect(prisma.stravaConnection.upsert).toHaveBeenCalledOnce();
    expect(syncService.syncStravaProfile).toHaveBeenCalledWith("user_1");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("strava=connected");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
npx vitest run app/api/strava/callback/route.test.ts
```

Expected: FAIL.

- [ ] **Step 6: Create `app/api/strava/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/stravaTokens";
import { syncStravaProfile } from "@/lib/stravaSyncService";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const scope = searchParams.get("scope") ?? "";
  const cookieState = request.cookies.get("strava_oauth_state")?.value;

  if (!state || state !== cookieState) {
    return NextResponse.json({ errors: ["Invalid OAuth state."] }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const clearState = (res: NextResponse) => {
    res.cookies.set("strava_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (!scope.includes("activity:read_all")) {
    return clearState(NextResponse.redirect(`${appUrl}/?strava=insufficient_scope`));
  }

  try {
    const tokenRes = await fetch("https://www.strava.com/api/v3/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return clearState(NextResponse.redirect(`${appUrl}/?strava=error`));
    }

    const data = await tokenRes.json();

    await prisma.stravaConnection.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        stravaAthleteId: data.athlete.id,
        accessToken: encryptToken(data.access_token),
        refreshToken: encryptToken(data.refresh_token),
        expiresAt: new Date(data.expires_at * 1000),
        scope,
      },
      update: {
        stravaAthleteId: data.athlete.id,
        accessToken: encryptToken(data.access_token),
        refreshToken: encryptToken(data.refresh_token),
        expiresAt: new Date(data.expires_at * 1000),
        scope,
        revokedAt: null,
      },
    });

    syncStravaProfile(user.id).catch((err) =>
      logServerError("Post-connect Strava sync failed", err),
    );

    return clearState(NextResponse.redirect(`${appUrl}/?strava=connected`));
  } catch (err) {
    logServerError("Strava callback error", err);
    return clearState(NextResponse.redirect(`${appUrl}/?strava=error`));
  }
}
```

- [ ] **Step 7: Run both route tests**

```bash
npx vitest run app/api/strava/connect/route.test.ts app/api/strava/callback/route.test.ts
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add app/api/strava/connect/ app/api/strava/callback/
git commit -m "feat: add Strava OAuth connect and callback routes"
```

---

### Task 7: Status, sync, and disconnect routes

**Files:**
- Create: `app/api/strava/status/route.ts` + test
- Create: `app/api/strava/sync/route.ts` + test
- Create: `app/api/strava/connection/route.ts` + test

- [ ] **Step 1: Create `app/api/strava/status/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ connected: false, syncedAt: null, hasProfile: false });

  const connection = await prisma.stravaConnection.findUnique({
    where: { userId: user.id },
    include: { profile: true },
  });

  if (!connection || connection.revokedAt) {
    return NextResponse.json({ connected: false, syncedAt: null, hasProfile: false });
  }

  return NextResponse.json({
    connected: true,
    syncedAt: connection.profile?.lastSyncedAt?.toISOString() ?? null,
    hasProfile: !!connection.profile,
  });
}
```

- [ ] **Step 2: Create `app/api/strava/status/route.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import * as apiAuth from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/apiAuth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { stravaConnection: { findUnique: vi.fn() } },
}));

function req() {
  return new NextRequest("http://localhost/api/strava/status");
}

describe("GET /api/strava/status", () => {
  it("returns connected:false when not authenticated", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue(null);
    expect((await (await GET(req())).json()).connected)).toBe(false);
  });

  it("returns connected:true with syncedAt when connected and profile exists", async () => {
    vi.mocked(apiAuth.getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    const syncedAt = new Date("2026-06-16T10:00:00Z");
    vi.mocked(prisma.stravaConnection.findUnique).mockResolvedValue({
      revokedAt: null,
      profile: { lastSyncedAt: syncedAt },
    } as never);

    const body = await (await GET(req())).json();
    expect(body.connected).toBe(true);
    expect(body.syncedAt).toBe(syncedAt.toISOString());
    expect(body.hasProfile).toBe(true);
  });
});
```

- [ ] **Step 3: Create `app/api/strava/sync/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { guardBrowserMutation } from "@/lib/security";
import { syncStravaProfile } from "@/lib/stravaSyncService";

export async function POST(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "strava-sync",
    limit: 1,
    windowMs: 60 * 60 * 1000,
  });
  if (guardResponse) return guardResponse;

  const user = await requireCurrentUser(request);
  if (!user) return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });

  try {
    await syncStravaProfile(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logServerError("Manual Strava sync failed", err);
    return NextResponse.json({ errors: ["Sync failed."] }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `app/api/strava/sync/route.test.ts`**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { NextRequest, NextResponse } from "next/server";
import * as apiAuth from "@/lib/apiAuth";
import * as syncService from "@/lib/stravaSyncService";
import { guardBrowserMutation } from "@/lib/security";

vi.mock("@/lib/apiAuth", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/lib/stravaSyncService", () => ({ syncStravaProfile: vi.fn() }));
vi.mock("@/lib/logging", () => ({ logServerError: vi.fn() }));
vi.mock("@/lib/security", () => ({ guardBrowserMutation: vi.fn(() => null) }));

function req() {
  return new NextRequest("http://localhost/api/strava/sync", { method: "POST" });
}

beforeEach(() => {
  vi.mocked(apiAuth.requireCurrentUser).mockReset();
  vi.mocked(syncService.syncStravaProfile).mockReset();
  vi.mocked(guardBrowserMutation).mockReturnValue(null);
});

describe("POST /api/strava/sync", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(apiAuth.requireCurrentUser).mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
  });

  it("returns ok:true after successful sync", async () => {
    vi.mocked(apiAuth.requireCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    vi.mocked(syncService.syncStravaProfile).mockResolvedValue();
    expect(await (await POST(req())).json()).toEqual({ ok: true });
  });

  it("returns guard response when rate limited", async () => {
    vi.mocked(guardBrowserMutation).mockReturnValue(
      NextResponse.json({ errors: ["Too many requests."] }, { status: 429 }),
    );
    expect((await POST(req())).status).toBe(429);
  });
});
```

- [ ] **Step 5: Create `app/api/strava/connection/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/apiAuth";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";
import { getValidAccessToken } from "@/lib/stravaTokens";

export async function DELETE(request: NextRequest) {
  const guardResponse = guardBrowserMutation(request, {
    key: "strava-disconnect",
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (guardResponse) return guardResponse;

  const user = await requireCurrentUser(request);
  if (!user) return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });

  try {
    const token = await getValidAccessToken(user.id).catch(() => null);
    if (token) {
      await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => logServerError("Strava deauthorize failed", err));
    }

    await prisma.stravaProfile.deleteMany({ where: { userId: user.id } });
    await prisma.stravaConnection.deleteMany({ where: { userId: user.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logServerError("Strava disconnect failed", err);
    return NextResponse.json({ errors: ["Disconnect failed."] }, { status: 500 });
  }
}
```

- [ ] **Step 6: Create `app/api/strava/connection/route.test.ts`**

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";
import { NextRequest } from "next/server";
import * as apiAuth from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import * as tokens from "@/lib/stravaTokens";

vi.mock("@/lib/apiAuth", () => ({ requireCurrentUser: vi.fn() }));
vi.mock("@/lib/logging", () => ({ logServerError: vi.fn() }));
vi.mock("@/lib/security", () => ({ guardBrowserMutation: vi.fn(() => null) }));
vi.mock("@/lib/stravaTokens", () => ({ getValidAccessToken: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    stravaProfile: { deleteMany: vi.fn() },
    stravaConnection: { deleteMany: vi.fn() },
  },
}));

function req() {
  return new NextRequest("http://localhost/api/strava/connection", { method: "DELETE" });
}

beforeEach(() => {
  vi.mocked(apiAuth.requireCurrentUser).mockReset();
  vi.mocked(prisma.stravaProfile.deleteMany).mockReset();
  vi.mocked(prisma.stravaConnection.deleteMany).mockReset();
  vi.mocked(tokens.getValidAccessToken).mockReset();
});

describe("DELETE /api/strava/connection", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(apiAuth.requireCurrentUser).mockResolvedValue(null);
    expect((await DELETE(req())).status).toBe(401);
  });

  it("deletes profile and connection records and returns ok:true", async () => {
    vi.mocked(apiAuth.requireCurrentUser).mockResolvedValue({ id: "user_1" } as never);
    vi.mocked(tokens.getValidAccessToken).mockResolvedValue("tok");
    vi.mocked(prisma.stravaProfile.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.stravaConnection.deleteMany).mockResolvedValue({ count: 1 } as never);
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as never;

    const res = await DELETE(req());
    expect(prisma.stravaProfile.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(prisma.stravaConnection.deleteMany).toHaveBeenCalledWith({ where: { userId: "user_1" } });
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 7: Run all three route tests**

```bash
npx vitest run app/api/strava/status/route.test.ts app/api/strava/sync/route.test.ts app/api/strava/connection/route.test.ts
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add app/api/strava/status/ app/api/strava/sync/ app/api/strava/connection/
git commit -m "feat: add Strava status, sync, and disconnect routes"
```

---

### Task 8: Update /api/auth/me PATCH for onboardingCompleted

**Files:**
- Modify: `lib/apiValidation.ts`
- Modify: `app/api/auth/me/route.ts`

- [ ] **Step 1: Add `validateMePatchPayload` to `lib/apiValidation.ts`**

Append after the existing `validateProfilePayload` function:

```typescript
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
```

- [ ] **Step 2: Update `app/api/auth/me/route.ts`**

Change the import line at the top from:

```typescript
import { validateProfilePayload } from "@/lib/apiValidation";
```

To:

```typescript
import { validateMePatchPayload } from "@/lib/apiValidation";
```

In the PATCH handler, change the validation call from:

```typescript
const validation = validateProfilePayload(await request.json().catch(() => null));
```

To:

```typescript
const validation = validateMePatchPayload(await request.json().catch(() => null));
```

In `prisma.user.update`, change the `data` block to:

```typescript
    data: {
      name: validation.value.name ?? null,
      defaultLevel: athleteLevelByLevel[validation.value.defaultLevel],
      defaultTargetTime: validation.value.defaultTargetTime,
      ...(validation.value.onboardingCompleted === true
        ? { onboardingCompletedAt: new Date() }
        : {}),
    },
```

Add `onboardingCompletedAt: true` to the `select` block:

```typescript
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        name: true,
        subscription: true,
        defaultLevel: true,
        defaultTargetTime: true,
        onboardingCompletedAt: true,
        createdAt: true,
      },
```

- [ ] **Step 3: Run existing me route tests to confirm no regressions**

```bash
npx vitest run app/api/auth/me/
```

Expected: all tests PASS.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/apiValidation.ts app/api/auth/me/route.ts
git commit -m "feat: accept onboardingCompleted in PATCH /api/auth/me"
```

---

### Task 9: Onboarding UI components

**Files:**
- Create: `styles/_onboarding.scss`
- Modify: `styles/globals.scss`
- Create: `components/onboarding/GoalScreen.tsx`
- Create: `components/onboarding/StravaConnectScreen.tsx`
- Create: `components/onboarding/OnboardingModal.tsx`
- Create: `components/OnboardingGate.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `styles/_onboarding.scss`**

```scss
.onboarding-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 16px;
}

.onboarding-modal {
  background: var(--color-surface, #0e1914);
  border: 1px solid var(--color-border, #284237);
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  &__title {
    font-size: 20px;
    font-weight: 900;
    color: var(--color-text, #f4f7ef);
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }

  &__subtitle {
    font-size: 13px;
    color: var(--color-text-muted, #9fb39a);
  }
}

.onboarding-goal-list {
  display: grid;
  gap: 8px;
}

.onboarding-goal-item {
  background: var(--color-surface-raised, #14241d);
  border: 1px solid var(--color-border, #284237);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--color-accent, #c8ff2e);
  }

  &__icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    color: var(--color-accent, #c8ff2e);
  }

  &__label {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text, #f4f7ef);
  }

  &__desc {
    font-size: 11px;
    color: var(--color-text-muted, #9fb39a);
    margin-top: 2px;
  }

  &__arrow {
    margin-left: auto;
    color: var(--color-accent, #c8ff2e);
    font-size: 16px;
  }
}

.onboarding-strava {
  &__lockup {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  &__brand {
    font-size: 14px;
    font-weight: 900;
    color: var(--color-text, #f4f7ef);
  }

  &__sep {
    color: var(--color-border, #284237);
    font-size: 13px;
  }

  &__benefits {
    display: grid;
    gap: 10px;
    margin-bottom: 20px;
  }

  &__benefit {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent, #c8ff2e);
    margin-top: 4px;
    flex-shrink: 0;
  }

  &__benefit-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-text, #f4f7ef);
  }

  &__benefit-desc {
    font-size: 11px;
    color: var(--color-text-muted, #9fb39a);
    margin-top: 2px;
  }

  &__connect-btn {
    width: 100%;
    background: #fc5200;
    border: none;
    border-radius: 10px;
    padding: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    text-decoration: none;
    margin-bottom: 8px;
  }

  &__skip-btn {
    width: 100%;
    background: none;
    border: 1px solid var(--color-border, #284237);
    border-radius: 10px;
    padding: 10px;
    font-size: 11px;
    color: var(--color-text-muted, #9fb39a);
    cursor: pointer;
  }
}
```

- [ ] **Step 2: Import `_onboarding.scss` in `styles/globals.scss`**

Add at the end of `styles/globals.scss`:

```scss
@use 'onboarding';
```

- [ ] **Step 3: Create `components/onboarding/GoalScreen.tsx`**

```typescript
"use client";

type Goal = "results" | "training" | "explore";

interface Props {
  onSelect: (goal: Goal) => void;
}

export function GoalScreen({ onSelect }: Props) {
  return (
    <div>
      <div className="onboarding-modal__title">Welcome to Ocht</div>
      <div className="onboarding-modal__subtitle">Pick the path that fits you</div>
      <div className="onboarding-goal-list" style={{ marginTop: 16 }}>
        <button className="onboarding-goal-item" onClick={() => onSelect("results")}>
          <svg className="onboarding-goal-item__icon" viewBox="0 0 40 40" fill="none">
            <line x1="6" y1="34" x2="34" y2="34" stroke="currentColor" strokeWidth="1.5" />
            <rect x="8" y="20" width="6" height="14" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.13" />
            <rect x="17" y="12" width="6" height="22" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.27" />
            <rect x="26" y="16" width="6" height="18" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.13" />
            <line x1="17" y1="6" x2="17" y2="12" stroke="currentColor" strokeWidth="1.5" />
            <polyline points="17,6 26,8 17,10" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.27" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="onboarding-goal-item__label">I&apos;ve done a race or training sim</div>
            <div className="onboarding-goal-item__desc">Enter your splits and get a full breakdown of where you lost time</div>
          </div>
          <span className="onboarding-goal-item__arrow">›</span>
        </button>

        <button className="onboarding-goal-item" onClick={() => onSelect("training")}>
          <svg className="onboarding-goal-item__icon" viewBox="0 0 40 40" fill="none">
            <polyline points="8,30 16,22 22,26 32,10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
            <circle cx="8" cy="30" r="2.5" fill="currentColor" fillOpacity="0.6" />
            <circle cx="16" cy="22" r="2.5" fill="currentColor" fillOpacity="0.6" />
            <circle cx="22" cy="26" r="2.5" fill="currentColor" fillOpacity="0.6" />
            <circle cx="32" cy="10" r="2.5" fill="currentColor" />
            <polyline points="27,6 32,10 28,15" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="onboarding-goal-item__label">I&apos;m training for my first Hyrox</div>
            <div className="onboarding-goal-item__desc">Connect Strava and we&apos;ll predict what time you could realistically target</div>
          </div>
          <span className="onboarding-goal-item__arrow">›</span>
        </button>

        <button className="onboarding-goal-item" onClick={() => onSelect("explore")}>
          <svg className="onboarding-goal-item__icon" viewBox="0 0 40 40" fill="none">
            <polyline points="3,20 9,20 12,10 16,30 20,14 24,26 28,20 37,20" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div>
            <div className="onboarding-goal-item__label">Just having a look</div>
            <div className="onboarding-goal-item__desc">Explore with a sample report — no data needed</div>
          </div>
          <span className="onboarding-goal-item__arrow">›</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/onboarding/StravaConnectScreen.tsx`**

```typescript
"use client";

interface Props {
  goal: "results" | "training";
  onSkip: () => void;
}

const BENEFITS = [
  { title: "Your predicted Hyrox time", desc: "Based on your real 5k and 10k times — not a generic estimate" },
  { title: "Training automatically filled in", desc: "We calculate your mileage, long run and intensity from your history" },
  { title: "Fade risk warning", desc: "We spot if your aerobic fitness suggests you'll slow in the second half" },
  { title: "Personal pace zones", desc: "Tailored to your heart rate — not textbook averages" },
];

export function StravaConnectScreen({ goal, onSkip }: Props) {
  return (
    <div>
      <div className="onboarding-strava__lockup">
        <span className="onboarding-strava__brand">Ocht</span>
        <span className="onboarding-strava__sep">✕</span>
        <svg width="80" height="20" viewBox="0 0 200 50" fill="none">
          <path d="M20 25L12 9L4 25h7.5l1-2.2 1 2.2H20z" fill="#FC5200" />
          <path d="M27 25l-6-13-6 13h7l1-2.2 1 2.2h3z" fill="#FC5200" opacity="0.55" />
          <text x="36" y="36" fontFamily="system-ui" fontWeight="800" fontSize="30" fill="#FC5200">Strava</text>
        </svg>
      </div>
      <div className="onboarding-modal__title" style={{ textAlign: "center" }}>Make your reports personal</div>
      <div className="onboarding-modal__subtitle" style={{ textAlign: "center", marginBottom: 16 }}>
        Ocht uses your Strava data to personalise every report
      </div>
      <div className="onboarding-strava__benefits">
        {BENEFITS.map((b) => (
          <div key={b.title} className="onboarding-strava__benefit">
            <div className="onboarding-strava__dot" />
            <div>
              <div className="onboarding-strava__benefit-title">{b.title}</div>
              <div className="onboarding-strava__benefit-desc">{b.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <a href="/api/strava/connect" className="onboarding-strava__connect-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        Connect with Strava
      </a>
      <button className="onboarding-strava__skip-btn" onClick={onSkip}>
        {goal === "results" ? "Skip — I'll enter training details manually" : "Skip — enter details manually"}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Create `components/onboarding/OnboardingModal.tsx`**

```typescript
"use client";

import { useRef, useState } from "react";
import { GoalScreen } from "./GoalScreen";
import { StravaConnectScreen } from "./StravaConnectScreen";

type Step = "goal" | "strava";
type Goal = "results" | "training" | "explore";

interface Props {
  onComplete: () => void;
}

export function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState<Goal | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  function handleGoalSelect(selected: Goal) {
    setGoal(selected);
    if (selected === "explore") {
      markComplete();
    } else {
      setStep("strava");
    }
  }

  function markComplete() {
    fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onboardingCompleted: true,
        defaultLevel: "competitive",
        defaultTargetTime: "1:25:00",
      }),
    }).catch(() => {});
    onComplete();
  }

  return (
    <div
      className="onboarding-backdrop"
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Ocht"
    >
      <div className="onboarding-modal">
        {step === "goal" && <GoalScreen onSelect={handleGoalSelect} />}
        {step === "strava" && goal && goal !== "explore" && (
          <StravaConnectScreen goal={goal} onSkip={markComplete} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `components/OnboardingGate.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { OnboardingModal } from "./onboarding/OnboardingModal";

export function OnboardingGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user && !data.user.onboardingCompletedAt) {
          setShow(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!show) return null;
  return <OnboardingModal onComplete={() => setShow(false)} />;
}
```

- [ ] **Step 7: Add `<OnboardingGate />` to `app/layout.tsx`**

Add import after the existing component imports:

```typescript
import { OnboardingGate } from "@/components/OnboardingGate";
```

In the `<body>`, after `{children}`:

```typescript
        {children}
        <OnboardingGate />
        <SiteFooter />
```

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add components/onboarding/ components/OnboardingGate.tsx styles/_onboarding.scss styles/globals.scss app/layout.tsx
git commit -m "feat: add goal-first onboarding flow with Strava connect screen"
```

---

### Task 10: Settings modal Strava section

**Files:**
- Modify: `components/SettingsModal.tsx`

- [ ] **Step 1: Read the current Privacy tab block in `components/SettingsModal.tsx` to identify the exact insertion point**

Open `components/SettingsModal.tsx` and locate the section rendered when `activeTab === "privacy"`. Note the line number of the first `<section>` or opening element inside that block.

- [ ] **Step 2: Add Strava state at the top of the `SettingsModal` function**

After the existing state declarations, add:

```typescript
  const [stravaConnected, setStravaConnected] = useState<boolean | null>(null);
  const [stravaSyncedAt, setStravaSyncedAt] = useState<string | null>(null);
  const [stravaDisconnecting, setStravaDisconnecting] = useState(false);
```

- [ ] **Step 3: Add useEffect to load Strava status**

After the existing `useEffect` hooks, add:

```typescript
  useEffect(() => {
    fetch("/api/strava/status")
      .then((r) => r.json())
      .then((data) => {
        setStravaConnected(data.connected);
        setStravaSyncedAt(data.syncedAt);
      })
      .catch(() => {});
  }, []);
```

- [ ] **Step 4: Add `handleStravaDisconnect` function before the return statement**

```typescript
  async function handleStravaDisconnect() {
    setStravaDisconnecting(true);
    try {
      const res = await fetch("/api/strava/connection", { method: "DELETE" });
      if (res.ok) {
        setStravaConnected(false);
        setStravaSyncedAt(null);
      }
    } finally {
      setStravaDisconnecting(false);
    }
  }
```

- [ ] **Step 5: Add Strava section in the Privacy tab JSX, before the existing data export/delete content**

Insert this block as the first child of the Privacy tab render:

```tsx
              <section className="settings-modal__section">
                <h3 className="settings-modal__section-title">Strava</h3>
                {stravaConnected === null && (
                  <p className="settings-modal__hint">Loading…</p>
                )}
                {stravaConnected === false && (
                  <>
                    <p className="settings-modal__hint">
                      Connect Strava to auto-fill your training data and get personalised predictions.
                    </p>
                    <a
                      href="/api/strava/connect"
                      className="settings-modal__btn settings-modal__btn--primary"
                    >
                      Connect with Strava
                    </a>
                  </>
                )}
                {stravaConnected === true && (
                  <>
                    <p className="settings-modal__hint">
                      Connected
                      {stravaSyncedAt
                        ? ` · Last synced ${new Date(stravaSyncedAt).toLocaleDateString()}`
                        : ""}
                    </p>
                    <button
                      className="settings-modal__btn settings-modal__btn--danger"
                      onClick={handleStravaDisconnect}
                      disabled={stravaDisconnecting}
                    >
                      {stravaDisconnecting ? "Disconnecting…" : "Disconnect Strava"}
                    </button>
                  </>
                )}
              </section>
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add components/SettingsModal.tsx
git commit -m "feat: add Strava connection management to settings modal Privacy tab"
```

---

### Task 11: Environment variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add Strava env vars to `.env.example`**

Append to `.env.example`:

```
# Strava OAuth integration
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
# 32-byte random key — generate with: openssl rand -base64 32
STRAVA_TOKEN_ENCRYPTION_KEY=
```

- [ ] **Step 2: Add values to your local `.env` (not committed)**

Generate the encryption key:

```bash
openssl rand -base64 32
```

Add to `.env`:

```
STRAVA_CLIENT_ID=<from Strava app dashboard>
STRAVA_CLIENT_SECRET=<from Strava app dashboard>
STRAVA_TOKEN_ENCRYPTION_KEY=<output of openssl command>
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add Strava env var placeholders to .env.example"
```

---

## Final checks

- [ ] `npx vitest run` — all tests pass
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npm run dev` — dev server starts; onboarding modal appears for a new user account
- [ ] Manual test: OAuth flow end-to-end requires `STRAVA_CLIENT_ID` + `STRAVA_CLIENT_SECRET` in `.env` and a registered Strava app with `http://localhost:3000/api/strava/callback` as an authorised redirect URI
