import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import { screenTargetLabel } from "@/lib/server/assets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import AssetUploadClient from "./AssetUploadClient";
import styles from "./assets.module.css";

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  agency_id: string;
  asset_due_at: string | null;
  asset_due_note: string | null;
}

interface SlotRow {
  id: string;
  order_item_id: string;
  screen_target: string;
  format: string;
  duration_seconds: number;
  status: string;
  specification_snapshot: Record<string, unknown>;
  current_asset_file_id: string | null;
}

interface AssetFileRow {
  id: string;
  asset_slot_id: string;
  version_number: number;
  status: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number | string;
  media_width_pixels: number | null;
  media_height_pixels: number | null;
  media_duration_seconds: number | string | null;
  uploaded_at: string;
}

export default async function OrderAssetsPage({
  params,
}: {
  params: { orderId: string };
}) {
  const access = await requireAgencyPurchaseAccess(
    `/portal/orders/${params.orderId}/assets`,
  );

  const admin = createSupabaseAdminClient();
  const { data: orderData } = await admin
    .from("orders")
    .select("id,order_number,status,agency_id,asset_due_at,asset_due_note")
    .eq("id", params.orderId)
    .eq("agency_id", access.agency.id)
    .maybeSingle();

  const order = orderData as OrderRow | null;

  if (!order) {
    notFound();
  }

  await admin.rpc("ensure_order_asset_slots", { p_order_id: order.id });

  const { data: slotData } = await admin
    .from("order_asset_slots")
    .select(
      "id,order_item_id,screen_target,format,duration_seconds,status,specification_snapshot,current_asset_file_id",
    )
    .eq("order_id", order.id)
    .order("created_at");

  const slotRows = (slotData ?? []) as SlotRow[];
  const slotIds = slotRows.map((slot) => slot.id);

  const { data: fileData } = slotIds.length
    ? await admin
        .from("asset_files")
        .select(
          "id,asset_slot_id,version_number,status,original_filename,mime_type,file_size_bytes,media_width_pixels,media_height_pixels,media_duration_seconds,uploaded_at",
        )
        .in("asset_slot_id", slotIds)
        .order("version_number", { ascending: false })
    : { data: [] as AssetFileRow[] };

  const files = (fileData ?? []) as AssetFileRow[];
  const grouped = new Map<string, AssetFileRow[]>();

  for (const file of files) {
    grouped.set(file.asset_slot_id, [
      ...(grouped.get(file.asset_slot_id) ?? []),
      file,
    ]);
  }

  const slots = slotRows.map((slot) => {
    const versions = (grouped.get(slot.id) ?? []).map((file) => ({
      id: file.id,
      versionNumber: file.version_number,
      status: file.status,
      filename: file.original_filename,
      mimeType: file.mime_type,
      fileSizeBytes: Number(file.file_size_bytes),
      width: file.media_width_pixels,
      height: file.media_height_pixels,
      durationSeconds:
        file.media_duration_seconds == null
          ? null
          : Number(file.media_duration_seconds),
      uploadedAt: file.uploaded_at,
    }));

    return {
      id: slot.id,
      screenTarget: slot.screen_target,
      screenLabel: screenTargetLabel(slot.screen_target),
      format: slot.format,
      durationSeconds: slot.duration_seconds,
      status: slot.status,
      specification: slot.specification_snapshot,
      currentFile:
        versions.find((file) => file.id === slot.current_asset_file_id) ?? null,
      versions,
    };
  });

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/portal" aria-label="Return to agency portal">
          <img
            className={styles.logo}
            src="/la-grandiosa-logo.png"
            alt="La Grandiosa"
          />
        </Link>
        <Link href="/portal/orders">Agency orders</Link>
      </header>

      <section className={styles.hero}>
        <p>PRIVATE ASSET REPOSITORY</p>
        <h1>{order.order_number}</h1>
        <p>
          Upload and preview every screen asset, preserve revision history, and
          make one final submission for processing-team review.
        </p>
      </section>

      <AssetUploadClient
        orderId={order.id}
        orderNumber={order.order_number}
        orderStatus={order.status}
        assetDueAt={order.asset_due_at ?? ""}
        assetDueNote={order.asset_due_note ?? ""}
        slots={slots}
      />
    </main>
  );
}
