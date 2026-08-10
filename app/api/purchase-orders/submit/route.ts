import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireAgencyPurchaseAccessForApi,
} from "@/lib/auth/access";
import { getCommerceServerConfig } from "@/lib/server/config";
import { processNotificationOutbox } from "@/lib/server/notification-delivery";
import { PURCHASE_ORDER_BUCKET } from "@/lib/server/procurement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function folderAndName(path: string): {
  folder: string;
  name: string;
} {
  const parts = path.split("/").filter(Boolean);
  const name = parts.pop() ?? "";

  return {
    folder: parts.join("/"),
    name,
  };
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAgencyPurchaseAccessForApi();
    const body = (await request.json()) as Record<string, unknown>;
    const orderId = String(body.orderId ?? "");
    const poNumber = String(body.poNumber ?? "").trim();
    const issueDate = String(body.issueDate ?? "").trim() || null;
    const note = String(body.note ?? "").trim();
    const storagePath = String(body.storagePath ?? "");
    const originalFilename = String(body.originalFilename ?? "");
    const mimeType = String(body.mimeType ?? "");
    const fileSizeBytes = Number(body.fileSizeBytes ?? 0);

    if (!orderId || !poNumber || !storagePath) {
      throw new Error(
        "Order, PO number, and uploaded PDF are required.",
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id,agency_id,order_number")
      .eq("id", orderId)
      .eq("agency_id", access.agency.id)
      .maybeSingle();

    if (!order) {
      throw new Error("The order is not available to this agency.");
    }

    const { folder, name } = folderAndName(storagePath);
    const { data: objects, error: listError } = await admin.storage
      .from(PURCHASE_ORDER_BUCKET)
      .list(folder, {
        search: name,
        limit: 10,
      });

    if (
      listError ||
      !objects?.some((object) => object.name === name)
    ) {
      throw new Error("The uploaded PDF could not be verified.");
    }

    const { data, error } = await admin.rpc(
      "submit_agency_purchase_order",
      {
        p_order_id: orderId,
        p_po_number: poNumber,
        p_issue_date: issueDate,
        p_note: note,
        p_storage_path: storagePath,
        p_original_filename: originalFilename,
        p_mime_type: mimeType,
        p_file_size_bytes: fileSizeBytes,
        p_actor_user_id: access.identity.userId,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    const result = Array.isArray(data) ? data[0] : data;
    const config = getCommerceServerConfig();

    await admin.from("notification_outbox").insert([
      {
        order_id: orderId,
        channel: "email",
        template_key: "customer_purchase_order_received",
        recipient: access.profile.email,
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key:
          `po-customer-${orderId}-` +
          `${result.document_version}`,
        payload: {
          orderNumber: order.order_number,
          poNumber,
          documentVersion: result.document_version,
          agencyName: access.agency.display_name,
        },
      },
      {
        order_id: orderId,
        channel: "email",
        template_key: "internal_purchase_order_review_required",
        recipient: config.internalProcessingEmail,
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key:
          `po-review-${orderId}-` +
          `${result.document_version}`,
        payload: {
          orderNumber: order.order_number,
          poNumber,
          documentVersion: result.document_version,
          agencyName: access.agency.display_name,
          purchaserName: access.profile.full_name,
        },
      },
    ]);

    // Best-effort immediate dispatch so PO confirmation/review emails are prompt.
    try {
      await processNotificationOutbox(10);
    } catch (deliveryError) {
      console.error("Purchase-order notification processing failed.", deliveryError);
    }

    return NextResponse.json({
      ok: true,
      purchaseOrderId: result.purchase_order_id,
      orderNumber: result.order_number,
      status: result.po_status,
      documentVersion: result.document_version,
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
            : "Purchase order submission failed.",
      },
      { status: 400 },
    );
  }
}
