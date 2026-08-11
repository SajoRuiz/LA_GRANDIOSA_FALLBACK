import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAgencyPurchaseAccess } from "@/lib/auth/access";
import { screenTargetLabel } from "@/lib/server/assets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import styles from "../assets.module.css";

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  agency_id: string;
}

interface SlotRow {
  id: string;
  screen_target: string;
  format: string;
  duration_seconds: number;
  specification_snapshot: Record<string, unknown>;
}

function formatMegabytes(value: unknown): string {
  const bytes = Number(value ?? 0);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Not configured";
  }

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function formatResolution(specification: Record<string, unknown>): string {
  const width = Number(specification.expectedWidthPixels ?? 0);
  const height = Number(specification.expectedHeightPixels ?? 0);

  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return `${width} x ${height} px`;
  }

  return "Pending final LED provider confirmation";
}

function formatTolerance(value: unknown): string {
  const tolerance = Number(value ?? 0);

  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    return "Not specified";
  }

  return `${tolerance.toFixed(Number.isInteger(tolerance) ? 0 : 1)} sec`;
}

export default async function AssetInstructionsPage({
  params,
}: {
  params: { orderId: string };
}) {
  const access = await requireAgencyPurchaseAccess(
    `/portal/orders/${params.orderId}/assets/instructions`,
  );

  const admin = createSupabaseAdminClient();
  const { data: orderData } = await admin
    .from("orders")
    .select("id,order_number,status,agency_id")
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
      "id,screen_target,format,duration_seconds,specification_snapshot",
    )
    .eq("order_id", order.id)
    .order("created_at");

  const slots = ((slotData ?? []) as SlotRow[]).map((slot) => ({
    id: slot.id,
    screenLabel: screenTargetLabel(slot.screen_target),
    format: slot.format,
    durationSeconds: slot.duration_seconds,
    specification: slot.specification_snapshot ?? {},
  }));

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
        <Link href={`/portal/orders/${order.id}/assets`}>
          Asset repository
        </Link>
      </header>

      <section className={styles.hero}>
        <p>UPLOAD INSTRUCTIONS</p>
        <h1>{order.order_number}</h1>
        <p>
          Follow this checklist before you upload files. The specifications
          below are the exact snapshot locked to this order.
        </p>
        <div className={styles.heroActions}>
          <Link href={`/portal/orders/${order.id}/assets`}>
            Return to asset uploads
          </Link>
        </div>
      </section>

      <div className={styles.instructionsLayout}>
        <section className={styles.stepPanel}>
          <h2>Step-by-step</h2>
          <ol>
            <li>Review the accepted file types, max file size, resolution target, duration target, and notes for each required screen below.</li>
            <li>Export still artwork as JPEG or PNG. Export motion files as silent MP4 or MOV files that match the purchased duration.</li>
            <li>If the resolution field says provider confirmation is pending, use the current provisional requirement and keep the source files ready for a later resize request.</li>
            <li>Return to the asset repository and upload one file per screen slot. Wait for the preview and progress bar to finish before leaving the page.</li>
            <li>After every required slot has a current file, click Submit final assets for review so the processing team receives the full batch.</li>
          </ol>
        </section>

        <section className={styles.stepPanel}>
          <h2>General reminders</h2>
          <p>Every upload is versioned. Replacing a file does not erase the previous version.</p>
          <p>Silent-video purchases should not include audio. Duration mismatch warnings appear when the browser-reported runtime is outside the allowed tolerance.</p>
          <p>The processing team reviews the submitted batch after you click the final submit button. Uploading a file by itself does not start formal review.</p>
        </section>

        <section className={styles.slotGuide}>
          <h2>Order-specific specifications</h2>
          <div className={styles.slotGuideGrid}>
            {slots.map((slot) => {
              const specification = slot.specification as Record<string, unknown>;
              const allowed = Array.isArray(specification.allowedMimeTypes)
                ? specification.allowedMimeTypes.join(", ")
                : "Configured file types";
              const notes =
                typeof specification.notes === "string" &&
                specification.notes.trim().length > 0
                  ? specification.notes.trim()
                  : "No additional technical notes.";

              return (
                <article className={styles.slot} key={slot.id}>
                  <div className={styles.slotHeading}>
                    <div>
                      <p>{slot.screenLabel}</p>
                      <h2>
                        {slot.format === "silent-video"
                          ? `${slot.durationSeconds}-second silent video`
                          : "Still image"}
                      </h2>
                    </div>
                  </div>

                  <dl className={styles.specList}>
                    <div><dt>Accepted file types</dt><dd>{allowed}</dd></div>
                    <div><dt>Max file size</dt><dd>{formatMegabytes(specification.maxFileSizeBytes)}</dd></div>
                    <div><dt>Expected resolution</dt><dd>{formatResolution(specification)}</dd></div>
                    <div><dt>Target duration</dt><dd>{slot.format === "silent-video" ? `${slot.durationSeconds} sec` : "Not applicable"}</dd></div>
                    <div><dt>Duration tolerance</dt><dd>{slot.format === "silent-video" ? formatTolerance(specification.durationToleranceSeconds) : "Not applicable"}</dd></div>
                    <div><dt>Technical notes</dt><dd>{notes}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}