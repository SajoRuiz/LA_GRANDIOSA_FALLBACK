import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ purchaseOrderId: string }> },
) {
  try {
    const { purchaseOrderId } = await context.params;
    const staff = await requireStaffAccessForApi([
      "finance",
      "system_admin",
    ]);
    const body = (await request.json()) as Record<string, unknown>;
    const decision = String(body.decision ?? "");
    const note = String(body.note ?? "").trim();

    if (![
      "approve",
      "revision",
      "decline",
    ].includes(decision)) {
      throw new Error("Purchase-order decision is invalid.");
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(
      "review_purchase_order",
      {
        p_purchase_order_id: purchaseOrderId,
        p_decision: decision,
        p_reviewer_note: note,
        p_actor_user_id: staff.identity.userId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const { data: order } = await admin
      .from("orders")
      .select("client_snapshot,agency_accounts(display_name)")
      .eq("id", result.order_id)
      .single();

    if (!order) {
      throw new Error("Order could not be found.");
    }

    const client = (order.client_snapshot ?? {}) as Record<
      string,
      unknown
    >;
    const agency = Array.isArray(order.agency_accounts)
      ? order.agency_accounts[0]
      : order.agency_accounts;
    const config = getCommerceServerConfig();

    if (client.email) {
      await admin.from("notification_outbox").insert({
        order_id: result.order_id,
        channel: "email",
        template_key:
          decision === "approve"
            ? "customer_purchase_order_approved"
            : decision === "revision"
              ? "customer_purchase_order_revision_requested"
              : "customer_purchase_order_declined",
        recipient: String(client.email),
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key:
          `po-${decision}-${purchaseOrderId}-` +
          `${Date.now()}`,
        payload: {
          orderNumber: result.order_number,
          agencyName: agency?.display_name ?? "",
          reviewerNote: note,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      orderId: result.order_id,
      orderNumber: result.order_number,
      status: result.po_status,
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
            : "Purchase-order review failed.",
      },
      { status: 400 },
    );
  }
}
