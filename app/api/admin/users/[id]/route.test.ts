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
