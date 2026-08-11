import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  AgencyAccessError,
  requireAgencyPurchaseAccessForApi,
} from "@/lib/auth/access";
import {
  cleanPdfFilename,
  MAX_PO_BYTES,
  PURCHASE_ORDER_BUCKET,
} from "@/lib/server/procurement";
import { getRouteRequestContext } from "@/lib/server/request-context";
import {
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/server/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const access = await requireAgencyPurchaseAccessForApi();
    const requestContext = getRouteRequestContext(request);

    await enforceRateLimit({
      scope: "purchase_order_upload_token_user",
      identifier: access.identity.userId,
      limit: 30,
      windowSeconds: 60 * 60,
      context: requestContext,
      actorUserId: access.identity.userId,
      actorEmail: access.identity.email,
      failClosed: process.env.NODE_ENV === "production",
    });

    const body = (await request.json()) as Record<string, unknown>;
    const orderId = String(body.orderId ?? "");
    const filename = cleanPdfFilename(
      String(body.filename ?? "purchase-order.pdf"),
    );
    const fileSize = Number(body.fileSize ?? 0);
    const mimeType = String(body.mimeType ?? "");

    if (!orderId || mimeType !== "application/pdf") {
      throw new Error("Select a valid PDF purchase-order document.");
    }

    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_PO_BYTES
    ) {
      throw new Error(
        "The purchase-order PDF must be 15 MB or smaller.",
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id,agency_id,status,credit_status")
      .eq("id", orderId)
      .eq("agency_id", access.agency.id)
      .maybeSingle();

    if (!order) {
      throw new Error("The order is not available to this agency.");
    }

    if (
      ![
        "client_information_received",
        "po_submitted",
        "po_revision_requested",
      ].includes(order.status)
    ) {
      throw new Error(
        "This order is not accepting a purchase order.",
      );
    }

    const storagePath =
      `${access.agency.id}/${orderId}/` +
      `${randomUUID()}-${filename}`;

    const { data, error } = await admin.storage
      .from(PURCHASE_ORDER_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data?.token) {
      throw new Error(
        error?.message ??
          "The secure upload URL could not be created.",
      );
    }

    return NextResponse.json({
      bucket: PURCHASE_ORDER_BUCKET,
      path: storagePath,
      token: data.token,
      expiresInSeconds: 7200,
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "RATE_LIMITED",
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        },
      );
    }

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
            : "Upload preparation failed.",
      },
      { status: 400 },
    );
  }
}
