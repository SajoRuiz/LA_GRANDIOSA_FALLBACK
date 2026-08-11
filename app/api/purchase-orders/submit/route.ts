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

interface PurchaseOrderSubmitResult {
  purchase_order_id: string;
  order_number: string;
  po_status: string;
  document_version: number;
}

function isAmbiguousPurchaseOrderIdError(message: string): boolean {
  return /purchase_order_id/i.test(message) && /ambiguous/i.test(message);
}

async function submitPurchaseOrderFallback(input: {
  orderId: string;
  poNumber: string;
  issueDate: string | null;
  note: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  actorUserId: string;
}): Promise<PurchaseOrderSubmitResult> {
  const admin = createSupabaseAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,order_number,status,credit_status,agency_id,client_contact_id")
    .eq("id", input.orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "Order not found.");
  }

  if (
    ![
      "client_information_received",
      "po_submitted",
      "po_revision_requested",
    ].includes(String(order.status))
  ) {
    throw new Error("This order is not accepting a purchase order.");
  }

  if (String(order.credit_status) === "exception_declined") {
    throw new Error("The order credit exception was declined.");
  }

  let purchaseOrderId = "";
  const { data: existingPo, error: existingPoError } = await admin
    .from("purchase_orders")
    .select("id")
    .eq("order_id", input.orderId)
    .maybeSingle();

  if (existingPoError) {
    throw new Error(existingPoError.message);
  }

  if (!existingPo) {
    const { data: createdPo, error: createPoError } = await admin
      .from("purchase_orders")
      .insert({
        order_id: input.orderId,
        agency_id: order.agency_id,
        po_number: input.poNumber,
        issue_date: input.issueDate,
        status: "submitted",
        note: input.note || null,
        submitted_by_user_id: input.actorUserId,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (createPoError || !createdPo) {
      throw new Error(
        createPoError?.message ??
          "Purchase order could not be created.",
      );
    }

    purchaseOrderId = String(createdPo.id);
  } else {
    purchaseOrderId = String(existingPo.id);
    const { error: updatePoError } = await admin
      .from("purchase_orders")
      .update({
        po_number: input.poNumber,
        issue_date: input.issueDate,
        status: "submitted",
        note: input.note || null,
        submitted_by_user_id: input.actorUserId,
        submitted_at: new Date().toISOString(),
        reviewer_user_id: null,
        reviewer_note: null,
        reviewed_at: null,
      })
      .eq("id", purchaseOrderId);

    if (updatePoError) {
      throw new Error(updatePoError.message);
    }
  }

  const { data: latestDoc, error: latestDocError } = await admin
    .from("purchase_order_documents")
    .select("version_number")
    .eq("purchase_order_id", purchaseOrderId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestDocError) {
    throw new Error(latestDocError.message);
  }

  const documentVersion = Number(latestDoc?.version_number ?? 0) + 1;

  const { error: documentError } = await admin
    .from("purchase_order_documents")
    .insert({
      purchase_order_id: purchaseOrderId,
      version_number: documentVersion,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
      uploaded_by_user_id: input.actorUserId,
    });

  if (documentError) {
    throw new Error(documentError.message);
  }

  if (String(order.status) !== "po_submitted") {
    const { error: transitionError } = await admin.rpc(
      "transition_order_status",
      {
        p_order_id: input.orderId,
        p_new_status: "po_submitted",
        p_actor_user_id: input.actorUserId,
        p_note: "Agency purchase order submitted.",
        p_metadata: {
          purchase_order_id: purchaseOrderId,
          po_number: input.poNumber,
          document_version: documentVersion,
        },
      },
    );

    if (transitionError) {
      throw new Error(transitionError.message);
    }
  }

  const { error: clientError } = await admin
    .from("client_contacts")
    .update({ purchase_order_number: input.poNumber })
    .eq("id", order.client_contact_id);

  if (clientError) {
    throw new Error(clientError.message);
  }

  await admin.from("audit_log").insert({
    order_id: input.orderId,
    actor_user_id: input.actorUserId,
    event_key: "purchase_order.submitted",
    entity_type: "purchase_order",
    entity_id: purchaseOrderId,
    metadata: {
      po_number: input.poNumber,
      document_version: documentVersion,
      storage_path: input.storagePath,
      fallback: "api-route",
    },
  });

  return {
    purchase_order_id: purchaseOrderId,
    order_number: String(order.order_number),
    po_status: "submitted",
    document_version: documentVersion,
  };
}

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

    let result = Array.isArray(data) ? data[0] : data;
    if (error) {
      if (!isAmbiguousPurchaseOrderIdError(error.message)) {
        throw new Error(error.message);
      }

      result = await submitPurchaseOrderFallback({
        orderId,
        poNumber,
        issueDate,
        note,
        storagePath,
        originalFilename,
        mimeType,
        fileSizeBytes,
        actorUserId: access.identity.userId,
      });
    }
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
