import { NextRequest, NextResponse } from "next/server";
import { logServerError } from "@/lib/logging";
import { guardBrowserMutation } from "@/lib/security";

const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 4000;
const MAX_PATHNAME_LENGTH = 300;

function truncate(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.length > max ? value.slice(0, max) : value;
}

export async function POST(request: NextRequest) {
  const guardResponse = await guardBrowserMutation(request, {
    key: "errors-report",
    limit: 20,
    windowMs: 5 * 60 * 1000,
  });

  if (guardResponse) {
    return guardResponse;
  }

  try {
    const body = await request.json();

    logServerError("Client error reported", {
      message: truncate(body?.message, MAX_MESSAGE_LENGTH),
      digest: truncate(body?.digest, 100),
      stack: truncate(body?.stack, MAX_STACK_LENGTH),
      pathname: truncate(body?.pathname, MAX_PATHNAME_LENGTH),
    });
  } catch (error) {
    logServerError("Failed to process client error report", error);
  }

  return NextResponse.json({ ok: true });
}
