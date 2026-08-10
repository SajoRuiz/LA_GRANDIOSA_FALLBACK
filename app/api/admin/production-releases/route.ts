import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import {
  getRouteRequestContext,
} from "@/lib/server/request-context";
import {
  recordSecurityEvent,
} from "@/lib/server/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaffAccessForApi([
      "system_admin",
    ]);
    const body = (await request.json()) as Record<
      string,
      unknown
    >;
    const releaseName = String(body.releaseName ?? "").trim();
    const gitCommit = String(body.gitCommit ?? "").trim();
    const deploymentUrl = String(
      body.deploymentUrl ?? "",
    ).trim();
    const notes = String(body.notes ?? "").trim();

    if (!releaseName) {
      throw new Error("Release name is required.");
    }

    if (
      deploymentUrl &&
      !deploymentUrl.startsWith("https://")
    ) {
      throw new Error(
        "Production deployment URL must use HTTPS.",
      );
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(
      "create_production_release_signoff",
      {
        p_release_name: releaseName,
        p_git_commit: gitCommit,
        p_deployment_url: deploymentUrl,
        p_notes: notes,
        p_actor_user_id: staff.identity.userId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    await recordSecurityEvent({
      eventKey: "production.release_signed_off",
      severity: "info",
      context: getRouteRequestContext(request),
      actorUserId: staff.identity.userId,
      actorEmail: staff.identity.email,
      metadata: {
        signoffId: data,
        releaseName,
        gitCommit,
        deploymentUrl,
      },
    });

    return NextResponse.json(
      { ok: true, signoffId: data },
      { status: 201 },
    );
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
            : "Production release could not be signed off.",
      },
      { status: 400 },
    );
  }
}
