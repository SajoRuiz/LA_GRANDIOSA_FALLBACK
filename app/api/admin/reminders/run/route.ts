import { NextResponse } from "next/server";
import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { withAutomationLock } from "@/lib/server/automation-lock";
import { getCommerceServerConfig } from "@/lib/server/config";
import { processNotificationOutbox } from "@/lib/server/notification-delivery";
import { queueOperationalReminders } from "@/lib/server/reminder-automation";

export async function POST() {
  try {
    await requireStaffAccessForApi(["finance", "system_admin"]);
    const result = await withAutomationLock(
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

    return NextResponse.json({
      ok: true,
      skipped: !result.acquired,
      ...(result.result ?? {}),
    });
  } catch (error) {
    if (error instanceof AgencyAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Reminder processing failed.",
      },
      { status: 400 },
    );
  }
}
