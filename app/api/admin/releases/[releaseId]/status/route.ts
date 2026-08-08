import { NextRequest, NextResponse } from "next/server";
import { AgencyAccessError, requireStaffAccessForApi } from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, context: { params: { releaseId: string } }) {
  try {
    const staff = await requireStaffAccessForApi(["sales_reviewer", "system_admin"]);
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const note = String(body.note ?? "").trim();
    const externalReference = String(body.externalReference ?? "").trim();
    if (!['released','live','failed'].includes(action)) throw new Error("Release action is invalid.");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("update_asset_release_status", {
      p_release_queue_id: context.params.releaseId,
      p_action: action,
      p_external_reference: externalReference,
      p_note: note,
      p_actor_user_id: staff.identity.userId,
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    const { data: order } = await admin.from("orders").select("client_snapshot,agency_accounts(display_name)").eq("id", result.order_id).single();
    const client = (order.client_snapshot ?? {}) as Record<string, unknown>;
    const agency = Array.isArray(order.agency_accounts) ? order.agency_accounts[0] : order.agency_accounts;
    const config = getCommerceServerConfig();
    if (client.email && ['released','live'].includes(action)) {
      await admin.from("notification_outbox").insert({
        order_id: result.order_id,
        channel: "email",
        template_key: action === "live" ? "customer_campaign_live" : "customer_assets_released",
        recipient: String(client.email),
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key: `release-${action}-${context.params.releaseId}`,
        payload: { orderNumber: result.order_number, agencyName: agency?.display_name ?? "", portalUrl: `${config.appBaseUrl}/portal/orders/${result.order_id}/assets` },
      });
    }
    return NextResponse.json({ ok: true, orderId: result.order_id, orderNumber: result.order_number, status: result.release_status });
  } catch (error) {
    if (error instanceof AgencyAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Release status could not be updated." }, { status: 400 });
  }
}
