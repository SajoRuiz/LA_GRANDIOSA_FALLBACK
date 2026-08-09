import { NextRequest, NextResponse } from "next/server";
import { requireStaffAccessForApi } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireStaffAccessForApi(["sales_reviewer", "finance", "system_admin"]);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("access_leads")
      .select("id,requester_name,requester_email,company_name,message,status,source,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, leads: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load leads." },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireStaffAccessForApi(["sales_reviewer", "finance", "system_admin"]);
    const body = await request.json();
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("access_leads")
      .update({ status: String(body.status ?? "new") })
      .eq("id", String(body.leadId ?? ""));

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update lead." },
      { status: 400 },
    );
  }
}
