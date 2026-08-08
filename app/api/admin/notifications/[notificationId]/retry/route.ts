import { NextResponse } from "next/server";
import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: { notificationId: string } },
) {
  try {
    await requireStaffAccessForApi(["finance", "system_admin"]);
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("retry_notification", {
      p_notification_id: context.params.notificationId,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
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
            : "Notification could not be retried.",
      },
      { status: 400 },
    );
  }
}
