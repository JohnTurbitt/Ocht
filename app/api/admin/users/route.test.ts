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
