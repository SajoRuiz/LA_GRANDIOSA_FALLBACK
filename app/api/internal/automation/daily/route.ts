import { NextRequest, NextResponse } from "next/server";
import { automationRequestIsAuthorized } from "@/lib/server/cron-auth";
import { getCommerceServerConfig } from "@/lib/server/config";
import { processNotificationOutbox } from "@/lib/server/notification-delivery";
import { queueOperationalReminders } from "@/lib/server/reminder-automation";
import { withAutomationLock } from "@/lib/server/automation-lock";
import { runSecurityMaintenance } from "@/lib/server/security-maintenance";
import { processLedReleaseQueue } from "@/lib/server/led-release";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function run(request: NextRequest) {
  if (!(await automationRequestIsAuthorized(request))) {
    return NextResponse.json(
      { error: "Automation authorization required." },
      { status: 401 },
    );
  }

  try {
    const result = await withAutomationLock(
      "daily-commerce-automation",
      240,
      async () => {
        const queued = await queueOperationalReminders();
        const config = getCommerceServerConfig();
        const delivered = await processNotificationOutbox(
          config.notificationBatchSize,
        );
        const releases = await processLedReleaseQueue(10);
        const security = await runSecurityMaintenance();
        return { queued, delivered, releases, security };
      },
    );

    if (!result.acquired) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Another daily automation worker is active.",
      });
    }

    return NextResponse.json({ ok: true, ...result.result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Daily automation failed.",
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
