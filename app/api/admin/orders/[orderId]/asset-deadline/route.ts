import { NextRequest, NextResponse } from "next/server";
import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function deadlineTimestamp(date: string): string | null {
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Enter a valid asset deadline date.");
  }
  // Puerto Rico remains UTC-4 year-round. Deadlines are set to 5:00 PM local.
  return new Date(`${date}T17:00:00-04:00`).toISOString();
}

export async function POST(
  request: NextRequest,
  context: { params: { orderId: string } },
) {
  try {
    const staff = await requireStaffAccessForApi([
      "sales_reviewer",
      "finance",
      "system_admin",
    ]);
    const body = (await request.json()) as Record<string, unknown>;
    const dueDate = String(body.dueDate ?? "").trim();
    const note = String(body.note ?? "").trim();
    const dueAt = deadlineTimestamp(dueDate);
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin.rpc(
      "set_order_asset_deadline",
      {
        p_order_id: context.params.orderId,
        p_due_at: dueAt,
        p_note: note,
        p_actor_user_id: staff.identity.userId,
      },
    );
    if (error) throw new Error(error.message);

    const result = Array.isArray(data) ? data[0] : data;
    const { data: order } = await admin
      .from("orders")
      .select(
        "id,order_number,client_snapshot,client_contacts(telephone,sms_transactional_consent),agency_accounts(display_name)",
      )
      .eq("id", context.params.orderId)
      .single();

    if (dueAt && order) {
      const config = getCommerceServerConfig();
      const client = (order.client_snapshot ?? {}) as Record<
        string,
        unknown
      >;
      const contact = Array.isArray(order.client_contacts)
        ? order.client_contacts[0]
        : order.client_contacts;
      const agency = Array.isArray(order.agency_accounts)
        ? order.agency_accounts[0]
        : order.agency_accounts;
      const payload = {
        orderNumber: order.order_number,
        agencyName: agency?.display_name ?? "",
        assetDueDate: dueDate,
        note,
        assetPortalUrl: `${config.appBaseUrl}/portal/orders/${order.id}/assets`,
      };
      const notifications: Array<Record<string, unknown>> = [];
      const email = String(client.email ?? "").trim().toLowerCase();

      if (email) {
        notifications.push({
          order_id: order.id,
          channel: "email",
          template_key: "customer_asset_deadline_set",
          recipient: email,
          sender_email: config.transactionalFromEmail,
          reply_to_email: config.salesReplyToEmail,
          payload,
          dedupe_key: `asset-deadline-set-email-${order.id}-${dueDate}`,
          category: "asset_deadline",
          priority: 30,
        });
      }

      if (notifications.length) {
        await admin.from("notification_outbox").upsert(notifications, {
          onConflict: "dedupe_key",
          ignoreDuplicates: true,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      orderId: result?.order_id ?? context.params.orderId,
      orderNumber: result?.order_number ?? "",
      assetDueAt: result?.asset_due_at ?? null,
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
            : "Asset deadline could not be saved.",
      },
      { status: 400 },
    );
  }
}
