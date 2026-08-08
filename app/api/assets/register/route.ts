import { NextRequest, NextResponse } from "next/server";
import { AgencyAccessError } from "@/lib/auth/access";
import { CAMPAIGN_ASSET_BUCKET, requireAssetSlotViewer, screenTargetLabel } from "@/lib/server/assets";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function pathParts(path: string) {
  const parts = path.split("/").filter(Boolean);
  const name = parts.pop() ?? "";
  return { folder: parts.join("/"), name };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const slotId = String(body.slotId ?? "");
    const storagePath = String(body.storagePath ?? "");
    const viewer = await requireAssetSlotViewer(slotId);
    if (viewer.isStaff) throw new AgencyAccessError("Agency upload access is required.", 403, "AGENCY_UPLOAD_REQUIRED");

    const admin = createSupabaseAdminClient();
    const { folder, name } = pathParts(storagePath);
    const { data: objects, error: listError } = await admin.storage.from(CAMPAIGN_ASSET_BUCKET).list(folder, { search: name, limit: 10 });
    const object = objects?.find((entry) => entry.name === name);
    if (listError || !object) throw new Error("The uploaded asset could not be verified in private storage.");

    const { data, error } = await admin.rpc("register_order_asset_file", {
      p_asset_slot_id: slotId,
      p_storage_path: storagePath,
      p_original_filename: String(body.originalFilename ?? name),
      p_mime_type: String(body.mimeType ?? ""),
      p_file_size_bytes: Number(body.fileSizeBytes ?? 0),
      p_media_width_pixels: body.mediaWidthPixels == null ? null : Number(body.mediaWidthPixels),
      p_media_height_pixels: body.mediaHeightPixels == null ? null : Number(body.mediaHeightPixels),
      p_media_duration_seconds: body.mediaDurationSeconds == null ? null : Number(body.mediaDurationSeconds),
      p_client_metadata: (body.clientMetadata ?? {}) as Record<string, unknown>,
      p_actor_user_id: viewer.userId,
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("order_number,client_snapshot,agency_accounts(display_name)")
      .eq("id", viewer.orderId)
      .single();
    if (orderError || !order) throw new Error(orderError?.message ?? "Order snapshot was not found.");

    const client = (order.client_snapshot ?? {}) as Record<string, unknown>;
    const agency = Array.isArray(order.agency_accounts) ? order.agency_accounts[0] : order.agency_accounts;
    const config = getCommerceServerConfig();
    if (client.email) {
      await admin.from("notification_outbox").insert({
        order_id: viewer.orderId,
        channel: "email",
        template_key: "customer_asset_upload_received",
        recipient: String(client.email),
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key: `asset-upload-${result.asset_file_id}`,
        payload: {
          orderNumber: order.order_number,
          agencyName: agency?.display_name ?? "",
          filename: String(body.originalFilename ?? name),
          screenLabel: screenTargetLabel(String(viewer.slot.screen_target)),
          assetPortalUrl: `${config.appBaseUrl}/portal/orders/${viewer.orderId}/assets`,
        },
      });
    }

    return NextResponse.json({ ok: true, assetFileId: result.asset_file_id, versionNumber: result.version_number });
  } catch (error) {
    if (error instanceof AgencyAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset registration failed." }, { status: 400 });
  }
}
