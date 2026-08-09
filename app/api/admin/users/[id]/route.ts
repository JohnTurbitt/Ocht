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
