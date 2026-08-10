import { NextRequest, NextResponse } from "next/server";
import { AgencyAccessError, requireAgencyPurchaseAccessForApi } from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const access = await requireAgencyPurchaseAccessForApi();
    const body = (await request.json()) as Record<string, unknown>;
    const orderId = String(body.orderId ?? "");
    const admin = createSupabaseAdminClient();
    const { data: order } = await admin.from("orders").select("id,order_number,agency_id,client_snapshot").eq("id", orderId).eq("agency_id", access.agency.id).maybeSingle();
    if (!order) throw new Error("The order is not available to this agency.");

    const { data, error } = await admin.rpc("submit_order_assets", { p_order_id: orderId, p_actor_user_id: access.identity.userId });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    const client = (order.client_snapshot ?? {}) as Record<string, unknown>;
    const config = getCommerceServerConfig();
    const notifications: Array<Record<string, unknown>> = [];
    if (client.email) {
      notifications.push({
        order_id: orderId,
        channel: "email",
        template_key: "customer_assets_submission_received",
        recipient: String(client.email),
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key: `assets-submission-customer-${result.asset_submission_id}`,
        payload: { orderNumber: order.order_number, agencyName: access.agency.display_name, submissionNumber: result.submission_number, assetPortalUrl: `${config.appBaseUrl}/portal/orders/${orderId}/assets` },
      });
    }
    notifications.push({
      order_id: orderId,
      channel: "email",
      template_key: "internal_assets_ready_for_review",
      recipient: config.internalProcessingEmail,
      sender_email: config.transactionalFromEmail,
      reply_to_email: config.salesReplyToEmail,
      dedupe_key: `assets-review-internal-${result.asset_submission_id}`,
      payload: { orderNumber: order.order_number, agencyName: access.agency.display_name, submissionNumber: result.submission_number, portalUrl: `${config.appBaseUrl}/admin/assets/${result.asset_submission_id}` },
    });
    await admin.from("notification_outbox").insert(notifications);
    return NextResponse.json({ ok: true, submissionId: result.asset_submission_id, submissionNumber: result.submission_number });
  } catch (error) {
    if (error instanceof AgencyAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Final assets could not be submitted." }, { status: 400 });
  }
}
