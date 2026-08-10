import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const STATUSES = new Set([
  "pending",
  "passed",
  "waived",
  "failed",
]);

export async function POST(
  request: NextRequest,
  context: { params: { itemId: string } },
) {
  try {
    const staff = await requireStaffAccessForApi([
      "system_admin",
    ]);
    const body = (await request.json()) as Record<
      string,
      unknown
    >;
    const status = String(body.status ?? "");
    const evidence = String(body.evidence ?? "").trim();

    if (!STATUSES.has(status)) {
      throw new Error("Launch-check status is invalid.");
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(
      "update_launch_checklist_item",
      {
        p_item_id: context.params.itemId,
        p_status: status,
        p_evidence: evidence,
        p_actor_user_id: staff.identity.userId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, item: data });
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
            : "Launch checklist could not be updated.",
      },
      { status: 400 },
    );
  }
}
