import { NextRequest, NextResponse } from "next/server";

import { automationRequestIsAuthorized } from "@/lib/server/cron-auth";
import { runSecurityMaintenance } from "@/lib/server/security-maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(request: NextRequest) {
  if (!(await automationRequestIsAuthorized(request))) {
    return NextResponse.json(
      { error: "Automation authorization required." },
      { status: 401 },
    );
  }

  try {
    return NextResponse.json({
      ok: true,
      ...(await runSecurityMaintenance()),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Security maintenance failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
