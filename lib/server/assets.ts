import { randomUUID } from "node:crypto";
import { AgencyAccessError, getVerifiedIdentity } from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const CAMPAIGN_ASSET_BUCKET = "campaign-assets";

export interface AssetViewer {
  userId: string;
  email: string;
  isStaff: boolean;
  agencyId: string;
  orderId: string;
}

export function cleanAssetFilename(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 140);
  return cleaned || `creative-${randomUUID()}`;
}

export function screenTargetLabel(value: string): string {
  return value === "left" ? "Left Screen" : value === "right" ? "Right Screen" : "Center Screen";
}

export async function requireAssetOrderViewer(orderId: string): Promise<AssetViewer> {
  const identity = await getVerifiedIdentity();
  if (!identity) throw new AgencyAccessError("Authentication is required.", 401, "AUTH_REQUIRED");
  if (identity.currentLevel !== "aal2") {
    throw new AgencyAccessError("Authenticator verification is required.", 403, "MFA_REQUIRED");
  }

  const admin = createSupabaseAdminClient();
  const { data: order } = await admin.from("orders").select("id,agency_id").eq("id", orderId).maybeSingle();
  if (!order?.agency_id) throw new AgencyAccessError("Order not found.", 404, "ORDER_NOT_FOUND");

  const [{ data: staff }, { data: membership }] = await Promise.all([
    admin.from("staff_members").select("role,active").eq("user_id", identity.userId).maybeSingle(),
    admin.from("agency_members").select("agency_id,status,can_purchase").eq("user_id", identity.userId).eq("agency_id", order.agency_id).maybeSingle(),
  ]);

  const isStaff = staff?.active === true;
  const isAgency = membership?.status === "active" && membership?.can_purchase === true;
  if (!isStaff && !isAgency) {
    throw new AgencyAccessError("The asset repository is not available to this account.", 403, "ASSET_ACCESS_DENIED");
  }

  return { userId: identity.userId, email: identity.email, isStaff, agencyId: String(order.agency_id), orderId };
}

export async function requireAssetSlotViewer(slotId: string): Promise<AssetViewer & { slot: any }> {
  const admin = createSupabaseAdminClient();
  const { data: slot } = await admin
    .from("order_asset_slots")
    .select("id,order_id,order_item_id,screen_target,format,duration_seconds,status,specification_snapshot,current_asset_file_id")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot) throw new AgencyAccessError("Asset slot not found.", 404, "ASSET_SLOT_NOT_FOUND");
  const viewer = await requireAssetOrderViewer(String(slot.order_id));
  return { ...viewer, slot };
}

export async function requireAssetFileViewer(assetFileId: string): Promise<AssetViewer & { file: any }> {
  const admin = createSupabaseAdminClient();
  const { data: file } = await admin
    .from("asset_files")
    .select("id,asset_slot_id,storage_bucket,storage_path,original_filename,mime_type,order_asset_slots(order_id)")
    .eq("id", assetFileId)
    .maybeSingle();
  const slot = Array.isArray(file?.order_asset_slots) ? file?.order_asset_slots[0] : file?.order_asset_slots;
  if (!file || !slot?.order_id) throw new AgencyAccessError("Asset file not found.", 404, "ASSET_FILE_NOT_FOUND");
  const viewer = await requireAssetOrderViewer(String(slot.order_id));
  return { ...viewer, file };
}
