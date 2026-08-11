import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import {
  getStage6SecurityReport,
  recordSecurityEvent,
} from "@/lib/server/security";
import { getRouteRequestContext } from "@/lib/server/request-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireStaffAccessForApi(["system_admin"]);
    const report = await getStage6SecurityReport();

    return NextResponse.json({ ok: true, report });
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
            : "Security audit could not be generated.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaffAccessForApi(["system_admin"]);
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const notes = String(body.notes ?? "").trim();
    const admin = createSupabaseAdminClient();

    if (action === "snapshot") {
      const { data, error } = await admin.rpc(
        "save_security_audit_snapshot",
        {
          p_actor_user_id: staff.identity.userId,
          p_notes: notes,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      await recordSecurityEvent({
        eventKey: "security.audit_snapshot_saved",
        context: getRouteRequestContext(request),
        actorUserId: staff.identity.userId,
        actorEmail: staff.identity.email,
        metadata: { snapshotId: data },
      });

      return NextResponse.json({
        ok: true,
        snapshotId: data,
      });
    }

    if (action === "purge-rate-limits") {
      const { data, error } = await admin.rpc(
        "purge_expired_rate_limits",
      );

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        ok: true,
        purgedBuckets: Number(data ?? 0),
      });
    }

    throw new Error("Security-audit action is invalid.");
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
            : "Security-audit action failed.",
      },
      { status: 400 },
    );
  }
}
