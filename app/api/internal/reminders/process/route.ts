import { NextRequest, NextResponse } from "next/server";
import { withAutomationLock } from "@/lib/server/automation-lock";
import { automationRequestIsAuthorized } from "@/lib/server/cron-auth";
import { getCommerceServerConfig } from "@/lib/server/config";
import { processNotificationOutbox } from "@/lib/server/notification-delivery";
import { queueOperationalReminders } from "@/lib/server/reminder-automation";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function run(request: NextRequest) {
  if (!(await automationRequestIsAuthorized(request))) {
    return NextResponse.json(
      { error: "Reminder-worker authorization required." },
      { status: 401 },
    );
  }

  try {
    const locked = await withAutomationLock(
      "operational-reminders",
      180,
      async () => {
        const queued = await queueOperationalReminders();
        const config = getCommerceServerConfig();
        const delivered = await processNotificationOutbox(
          config.notificationBatchSize,
        );
        return { queued, delivered };
      },
    );

    if (!locked.acquired) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "Another reminder worker is active.",
      });
    }

    return NextResponse.json({
      ok: true,
      ...locked.result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Reminder processing failed.",
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
