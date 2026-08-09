import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { applyAdminOverride, loadAdminUserDetail } from "@/lib/adminUsers";
import { validateAdminOverridePayload } from "@/lib/apiValidation";
import { guardBrowserMutation } from "@/lib/security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  // Admin gating runs before the rate-limit/origin guard so a non-admin always
  // gets the same bare 404 regardless of headers or request volume — matching
  // the GET routes and keeping this endpoint indistinguishable from a
  // nonexistent one to anyone who isn't already a verified admin.
  const admin = await requireAdmin(request);

  if (!admin) {
    return NextResponse.json({}, { status: 404 });
  }

  const guardResponse = await guardBrowserMutation(request, {
    key: "admin-override",
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
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
