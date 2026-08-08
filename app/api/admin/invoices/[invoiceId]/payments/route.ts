import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const METHODS = new Set([
  "ach",
  "wire",
  "check",
  "manual",
  "future_card",
]);

export async function POST(
  request: NextRequest,
  context: { params: { invoiceId: string } },
) {
  try {
    const staff = await requireStaffAccessForApi([
      "finance",
      "system_admin",
    ]);
    const body = (await request.json()) as Record<string, unknown>;
    const amountDollars = Number(body.amountDollars ?? 0);
    const amountCents = Math.round(amountDollars * 100);
    const method = String(body.method ?? "");
    const receivedDate = String(body.receivedDate ?? "");
    const reference = String(body.reference ?? "").trim();
    const note = String(body.note ?? "").trim();

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error("Enter a valid payment amount.");
    }

    if (!METHODS.has(method)) {
      throw new Error("Payment method is invalid.");
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
      throw new Error("Payment received date is required.");
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(
      "record_invoice_payment",
      {
        p_invoice_id: context.params.invoiceId,
        p_amount_cents: amountCents,
        p_method: method,
        p_received_date: receivedDate,
        p_reference: reference,
        p_note: note,
        p_actor_user_id: staff.identity.userId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .select("order_id,client_snapshot,agency_snapshot")
      .eq("id", context.params.invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error(invoiceError?.message ?? "Invoice not found.");
    }

    const client = (invoice.client_snapshot ?? {}) as Record<
      string,
      unknown
    >;
    const agency = (invoice.agency_snapshot ?? {}) as Record<
      string,
      unknown
    >;
    const config = getCommerceServerConfig();

    if (client.email) {
      await admin.from("notification_outbox").insert({
        order_id: invoice.order_id,
        channel: "email",
        template_key:
          result.invoice_status === "paid"
            ? "customer_invoice_paid"
            : "customer_invoice_partial_payment",
        recipient: String(client.email),
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key:
          `invoice-payment-${context.params.invoiceId}-` +
          `${Date.now()}`,
        payload: {
          invoiceNumber: result.invoice_number,
          paymentAmountCents: amountCents,
          paidCents: Number(result.paid_cents),
          balanceCents: Number(result.balance_cents),
          status: result.invoice_status,
          agencyName: agency.displayName ?? "",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      invoiceNumber: result.invoice_number,
      status: result.invoice_status,
      paidCents: Number(result.paid_cents),
      balanceCents: Number(result.balance_cents),
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
            : "Payment could not be recorded.",
      },
      { status: 400 },
    );
  }
}
