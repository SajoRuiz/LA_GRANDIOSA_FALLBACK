import { NextRequest, NextResponse } from "next/server";
import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  context: { params: { notificationId: string } },
) {
  try {
    await requireStaffAccessForApi(["finance", "system_admin"]);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("cancel_notification", {
      p_notification_id: context.params.notificationId,
      p_reason: String(body.reason ?? "Cancelled by an administrator."),
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
            : "Notification could not be cancelled.",
      },
      { status: 400 },
    );
  }
}
