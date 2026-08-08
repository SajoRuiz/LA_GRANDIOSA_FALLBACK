import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const staff = await requireStaffAccessForApi([
      "finance",
      "system_admin",
    ]);
    const body = (await request.json()) as Record<string, unknown>;
    const orderId = String(body.orderId ?? "");
    const remittanceAccountId = String(
      body.remittanceAccountId ?? "",
    );

    if (!orderId || !remittanceAccountId) {
      throw new Error(
        "Order and remittance account are required.",
      );
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(
      "issue_invoice_for_order",
      {
        p_order_id: orderId,
        p_remittance_account_id: remittanceAccountId,
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
      .eq("id", orderId)
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
      await admin.from("notification_outbox").insert([
        {
          order_id: orderId,
          channel: "email",
          template_key: "customer_invoice_issued",
          recipient: String(client.email),
          sender_email: config.transactionalFromEmail,
          reply_to_email: config.salesReplyToEmail,
          dedupe_key: `invoice-customer-${result.invoice_id}`,
          payload: {
            invoiceId: result.invoice_id,
            invoiceNumber: result.invoice_number,
            invoiceTotalCents: Number(
              result.invoice_total_cents,
            ),
            dueDate: result.invoice_due_date,
            agencyName: agency?.display_name ?? "",
            invoiceUrl:
              `${config.appBaseUrl}/portal/invoices/` +
              `${result.invoice_id}`,
            assetUploadStatus: "opens_after_invoice_issue",
          },
        },
        {
          order_id: orderId,
          channel: "email",
          template_key: "internal_invoice_issued",
          recipient: config.internalProcessingEmail,
          sender_email: config.transactionalFromEmail,
          reply_to_email: config.salesReplyToEmail,
          dedupe_key: `invoice-internal-${result.invoice_id}`,
          payload: {
            invoiceId: result.invoice_id,
            invoiceNumber: result.invoice_number,
            invoiceTotalCents: Number(
              result.invoice_total_cents,
            ),
            dueDate: result.invoice_due_date,
            agencyName: agency?.display_name ?? "",
          },
        },
      ]);
    }

    return NextResponse.json(
      {
        ok: true,
        invoiceId: result.invoice_id,
        invoiceNumber: result.invoice_number,
        totalCents: Number(result.invoice_total_cents),
        dueDate: result.invoice_due_date,
      },
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
            : "Invoice could not be issued.",
      },
      { status: 400 },
    );
  }
}
