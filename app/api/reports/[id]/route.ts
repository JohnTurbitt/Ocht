import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { guardBrowserMutation } from "@/lib/security";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const guardResponse = await guardBrowserMutation(request, {
    key: "reports-delete",
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const user = await requireCurrentUser(request);

  if (!user) {
    return NextResponse.json({ errors: ["Sign in required."] }, { status: 401 });
  }

  const { id } = await context.params;
  // Include userId in the delete condition so a valid report id from another
  // account cannot be deleted.
  const result = await prisma.raceReport.deleteMany({
    where: {
      id,
      userId: user.id,
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ errors: ["Report not found."] }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
