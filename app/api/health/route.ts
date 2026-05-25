import { NextResponse } from "next/server";
import { logServerError } from "@/lib/logging";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        ok: true,
        database: "ok",
        timestamp,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    logServerError("Health check failed", error);

    return NextResponse.json(
      {
        ok: false,
        database: "unavailable",
        timestamp,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
