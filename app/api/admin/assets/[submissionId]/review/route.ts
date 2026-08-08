import { NextRequest, NextResponse } from "next/server";
import { AgencyAccessError, requireStaffAccessForApi } from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, context: { params: { submissionId: string } }) {
  try {
    const staff = await requireStaffAccessForApi(["sales_reviewer", "system_admin"]);
    const body = (await request.json()) as Record<string, unknown>;
    const decision = String(body.decision ?? "");
    const reviewNote = String(body.reviewNote ?? "").trim();
    const itemDecisions = Array.isArray(body.itemDecisions) ? body.itemDecisions : [];
    if (!['approve','revision'].includes(decision)) throw new Error("Asset-review decision is invalid.");

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("review_asset_submission", {
      p_asset_submission_id: context.params.submissionId,
      p_decision: decision,
      p_review_note: reviewNote,
      p_item_decisions: itemDecisions,
      p_actor_user_id: staff.identity.userId,
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    const { data: order, error: orderError } = await admin.from("orders").select("client_snapshot,agency_accounts(display_name)").eq("id", result.order_id).single();
    if (orderError || !order) throw new Error(orderError?.message ?? "Order not found.");
    const client = (order.client_snapshot ?? {}) as Record<string, unknown>;
    const agency = Array.isArray(order.agency_accounts) ? order.agency_accounts[0] : order.agency_accounts;
    const config = getCommerceServerConfig();
    const notifications: Array<Record<string, unknown>> = [];
    if (client.email) {
      notifications.push({
        order_id: result.order_id,
        channel: "email",
        template_key: decision === "approve" ? "customer_assets_approved" : "customer_assets_revision_requested",
        recipient: String(client.email),
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key: `asset-review-customer-${context.params.submissionId}-${decision}`,
        payload: { orderNumber: result.order_number, agencyName: agency?.display_name ?? "", reviewerNote: reviewNote, assetPortalUrl: `${config.appBaseUrl}/portal/orders/${result.order_id}/assets` },
      });
    }
    if (decision === "approve") {
      notifications.push({
        order_id: result.order_id,
        channel: "email",
        template_key: "internal_assets_release_ready",
        recipient: config.internalProcessingEmail,
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key: `asset-release-ready-${context.params.submissionId}`,
        payload: { orderNumber: result.order_number, agencyName: agency?.display_name ?? "", portalUrl: `${config.appBaseUrl}/admin/releases` },
      });
    }
    if (client.sms_transactional_consent && client.telephone) {
      notifications.push({
        order_id: result.order_id,
        channel: "sms",
        template_key: decision === "approve" ? "customer_assets_approved" : "customer_assets_revision_requested",
        recipient: String(client.telephone),
        sender_email: "",
        reply_to_email: "",
        dedupe_key: `asset-review-sms-${context.params.submissionId}-${decision}`,
        payload: { orderNumber: result.order_number, reviewerNote: reviewNote, assetPortalUrl: `${config.appBaseUrl}/portal/orders/${result.order_id}/assets` },
      });
    }
    if (notifications.length) await admin.from("notification_outbox").insert(notifications);
    return NextResponse.json({ ok: true, orderId: result.order_id, orderNumber: result.order_number, status: result.submission_status, releaseQueueId: result.release_queue_id });
  } catch (error) {
    if (error instanceof AgencyAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset review failed." }, { status: 400 });
  }
}
