import { NextRequest, NextResponse } from "next/server";

import { automationRequestIsAuthorized } from "@/lib/server/cron-auth";
import { processLedReleaseQueue } from "@/lib/server/led-release";
import { withAutomationLock } from "@/lib/server/automation-lock";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function run(request: NextRequest) {
  if (!(await automationRequestIsAuthorized(request))) {
    return NextResponse.json(
      { error: "Release-worker authorization required." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const requestedLimit = Number(body.limit ?? 10);
  const limit = Math.max(1, Math.min(requestedLimit, 50));

  try {
    const locked = await withAutomationLock(
      "led-release-processing",
      120,
      () => processLedReleaseQueue(limit),
    );

    if (!locked.acquired) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Another LED release worker is active.",
      });
    }

    return NextResponse.json({ ok: true, ...locked.result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "LED release processing failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return run(request);
}

export async function GET(request: NextRequest) {
  return run(request);
}
