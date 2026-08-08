import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import { screenTargetLabel } from "@/lib/server/assets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AssetUploadClient from "./AssetUploadClient";
import styles from "./assets.module.css";

export default async function OrderAssetsPage({ params }: { params: { orderId: string } }) {
  const access = await requireAgencyPurchaseAccess(`/portal/orders/${params.orderId}/assets`);
  const admin = createSupabaseAdminClient();
  const { data: order } = await admin.from("orders").select("id,order_number,status,agency_id").eq("id", params.orderId).eq("agency_id", access.agency.id).maybeSingle();
  if (!order) notFound();
  await admin.rpc("ensure_order_asset_slots", { p_order_id: order.id });
  const { data: slotRows } = await admin.from("order_asset_slots").select("id,order_item_id,screen_target,format,duration_seconds,status,specification_snapshot,current_asset_file_id").eq("order_id", order.id).order("created_at");
  const slotIds = (slotRows ?? []).map((slot) => slot.id);
  const { data: files } = slotIds.length ? await admin.from("asset_files").select("id,asset_slot_id,version_number,status,original_filename,mime_type,file_size_bytes,media_width_pixels,media_height_pixels,media_duration_seconds,uploaded_at").in("asset_slot_id", slotIds).order("version_number", { ascending: false }) : { data: [] as any[] };
  const grouped = new Map<string, any[]>();
  for (const file of files ?? []) grouped.set(file.asset_slot_id, [...(grouped.get(file.asset_slot_id) ?? []), file]);
  const slots = (slotRows ?? []).map((slot) => {
    const versions = (grouped.get(slot.id) ?? []).map((file) => ({ id: file.id, versionNumber: file.version_number, status: file.status, filename: file.original_filename, mimeType: file.mime_type, fileSizeBytes: Number(file.file_size_bytes), width: file.media_width_pixels, height: file.media_height_pixels, durationSeconds: file.media_duration_seconds == null ? null : Number(file.media_duration_seconds), uploadedAt: file.uploaded_at }));
    return { id: slot.id, screenTarget: slot.screen_target, screenLabel: screenTargetLabel(slot.screen_target), format: slot.format, durationSeconds: slot.duration_seconds, status: slot.status, specification: slot.specification_snapshot, currentFile: versions.find((file) => file.id === slot.current_asset_file_id) ?? null, versions };
  });
  return <main className={styles.page}><header className={styles.header}><Link href="/portal"><img className={styles.logo} src="/la-grandiosa-logo.png" alt="La Grandiosa" /></Link><Link href="/portal/orders">Agency orders</Link></header><section className={styles.hero}><p>PRIVATE ASSET REPOSITORY</p><h1>{order.order_number}</h1><p>Upload and preview every screen asset, preserve revision history, and make one final submission for processing-team review.</p></section><AssetUploadClient orderId={order.id} orderNumber={order.order_number} orderStatus={order.status} slots={slots} /></main>;
}
