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
