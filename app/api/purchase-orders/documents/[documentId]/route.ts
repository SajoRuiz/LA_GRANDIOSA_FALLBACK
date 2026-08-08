import { NextResponse } from "next/server";

import { AgencyAccessError } from "@/lib/auth/access";
import {
  PURCHASE_ORDER_BUCKET,
  requireOrderViewerForApi,
} from "@/lib/server/procurement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: { documentId: string } },
) {
  try {
    const admin = createSupabaseAdminClient();
    const { data: document } = await admin
      .from("purchase_order_documents")
      .select(
        "id,storage_path,original_filename,purchase_orders(order_id)",
      )
      .eq("id", context.params.documentId)
      .maybeSingle();

    const po = Array.isArray(document?.purchase_orders)
      ? document.purchase_orders[0]
      : document?.purchase_orders;

    if (!document || !po?.order_id) {
      throw new AgencyAccessError(
        "Purchase-order document not found.",
        404,
        "DOCUMENT_NOT_FOUND",
      );
    }

    await requireOrderViewerForApi(String(po.order_id));

    const { data, error } = await admin.storage
      .from(PURCHASE_ORDER_BUCKET)
      .createSignedUrl(document.storage_path, 60, {
        download: document.original_filename,
      });

    if (error || !data?.signedUrl) {
      throw new Error(
        error?.message ??
          "Secure download link could not be created.",
      );
    }

    return NextResponse.redirect(data.signedUrl);
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
            : "Document download failed.",
      },
      { status: 400 },
    );
  }
}
