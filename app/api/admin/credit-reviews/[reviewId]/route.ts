import { NextRequest, NextResponse } from "next/server";
import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  context: { params: { reviewId: string } },
) {
  try {
    const staff = await requireStaffAccessForApi([
      "finance",
      "system_admin",
    ]);
    const { reviewId } = context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const decision = body.decision === "approve" ? "approve" : "decline";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin.rpc(
      "resolve_agency_credit_review",
      {
        p_review_id: reviewId,
        p_approve: decision === "approve",
        p_reviewer_note: note,
        p_actor_user_id: staff.identity.userId,
      },
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      ok: true,
      orderId: result?.order_id,
      orderNumber: result?.order_number,
      creditStatus: result?.credit_status,
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
            : "Credit review could not be updated.",
      },
      { status: 400 },
    );
  }
}
