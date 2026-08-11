import { getLedScreenProvider } from "@/lib/led/provider";
import type {
  LedCampaignRelease,
  LedReleaseStatus,
  LedStatusResult,
  LedSubmitResult,
} from "@/lib/led/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type QueueStatus =
  | "pending"
  | "processing"
  | "submitted"
  | "acknowledged"
  | "released"
  | "live"
  | "failed"
  | "cancelled";

interface ReleaseQueueRow {
  id: string;
  order_id: string;
  asset_submission_id: string;
  status: QueueStatus;
  external_reference: string | null;
}

interface OrderItemRow {
  start_date: string;
  end_date: string;
}

function mapProviderStatus(status: LedReleaseStatus): QueueStatus {
  switch (status) {
    case "submitted":
      return "submitted";
    case "acknowledged":
      return "acknowledged";
    case "released":
      return "released";
    case "live":
      return "live";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

async function getReleaseQueueRow(
  releaseId: string,
): Promise<ReleaseQueueRow> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("asset_release_queue")
    .select("id,order_id,asset_submission_id,status,external_reference")
    .eq("id", releaseId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Release queue row not found.");
  }

  return data as ReleaseQueueRow;
}

export async function buildLedCampaignRelease(
  releaseId: string,
): Promise<LedCampaignRelease> {
  const admin = createSupabaseAdminClient();
  const release = await getReleaseQueueRow(releaseId);

  const [{ data: order, error: orderError }, { data: items, error: itemsError }, { data: assetItems, error: assetItemsError }] = await Promise.all([
    admin
      .from("orders")
      .select("id,order_number")
      .eq("id", release.order_id)
      .single(),
    admin
      .from("order_items")
      .select("start_date,end_date")
      .eq("order_id", release.order_id),
    admin
      .from("asset_submission_items")
      .select(
        "asset_slot_id,asset_file_id,order_asset_slots(screen_target,duration_seconds),asset_files(storage_bucket,storage_path,original_filename,mime_type)",
      )
      .eq("submission_id", release.asset_submission_id),
  ]);

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "Order record not found.");
  }

  if (itemsError || !items || items.length === 0) {
    throw new Error(
      itemsError?.message ?? "Order items are required for release scheduling.",
    );
  }

  if (assetItemsError || !assetItems || assetItems.length === 0) {
    throw new Error(
      assetItemsError?.message ?? "Submission assets were not found.",
    );
  }

  const scheduleItems = items as OrderItemRow[];
  const startDate = scheduleItems
    .map((item) => item.start_date)
    .sort()[0];
  const endDate = scheduleItems
    .map((item) => item.end_date)
    .sort()
    .slice(-1)[0];

  const assets = [] as LedCampaignRelease["assets"];
  for (const raw of assetItems as Array<Record<string, any>>) {
    const slot = Array.isArray(raw.order_asset_slots)
      ? raw.order_asset_slots[0]
      : raw.order_asset_slots;
    const file = Array.isArray(raw.asset_files)
      ? raw.asset_files[0]
      : raw.asset_files;

    if (!slot?.screen_target || !file?.storage_bucket || !file?.storage_path) {
      continue;
    }

    const signed = await admin.storage
      .from(String(file.storage_bucket))
      .createSignedUrl(String(file.storage_path), 900);

    if (signed.error || !signed.data?.signedUrl) {
      throw new Error(
        signed.error?.message ??
          `Could not sign asset URL for ${file.storage_path}.`,
      );
    }

    assets.push({
      screenTarget: String(slot.screen_target) as
        | "left"
        | "center"
        | "right",
      signedDownloadUrl: signed.data.signedUrl,
      filename: String(file.original_filename ?? "asset"),
      mimeType: String(file.mime_type ?? "application/octet-stream"),
      durationSeconds:
        slot.duration_seconds != null
          ? Number(slot.duration_seconds)
          : undefined,
    });
  }

  if (assets.length === 0) {
    throw new Error("No release-ready assets were available for provider submit.");
  }

  return {
    releaseId: release.id,
    orderId: String(order.id),
    orderNumber: String((order as Record<string, unknown>).order_number ?? ""),
    startDate,
    endDate,
    assets,
    metadata: {
      assetSubmissionId: release.asset_submission_id,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function persistProviderState(input: {
  releaseId: string;
  providerKey: string;
  externalReference: string;
  status: QueueStatus;
  raw?: Record<string, unknown>;
  note?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("asset_release_queue")
    .update({
      provider_key: input.providerKey,
      external_reference: input.externalReference,
      status: input.status,
      last_error: input.note ?? null,
      request_payload: input.raw ?? {},
      processing_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.releaseId);

  if (error) {
    throw new Error(error.message);
  }
}

async function applyOrderTransition(
  releaseId: string,
  action: "released" | "live" | "failed",
  externalReference: string,
  actorUserId: string,
  note: string,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("update_asset_release_status", {
    p_release_queue_id: releaseId,
    p_action: action,
    p_external_reference: externalReference,
    p_note: note,
    p_actor_user_id: actorUserId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function completeStatusEffects(
  releaseId: string,
  status: QueueStatus,
  externalReference: string,
  actorUserId: string,
) {
  if (status === "released") {
    await applyOrderTransition(
      releaseId,
      "released",
      externalReference,
      actorUserId,
      "LED provider acknowledged campaign release.",
    );
    return;
  }

  if (status === "live") {
    await applyOrderTransition(
      releaseId,
      "released",
      externalReference,
      actorUserId,
      "LED provider acknowledged campaign release.",
    );
    await applyOrderTransition(
      releaseId,
      "live",
      externalReference,
      actorUserId,
      "LED provider reported campaign live.",
    );
    return;
  }

  if (status === "failed") {
    await applyOrderTransition(
      releaseId,
      "failed",
      externalReference,
      actorUserId,
      "LED provider reported campaign failure.",
    );
  }
}

export async function submitLedRelease(
  releaseId: string,
  actorUserId: string,
): Promise<{ status: QueueStatus; externalReference: string }> {
  const provider = getLedScreenProvider();
  if (provider.mode !== "api") {
    throw new Error("LED provider API mode is disabled.");
  }

  const release = await buildLedCampaignRelease(releaseId);
  const submit = await provider.submitCampaign(release);
  const status = mapProviderStatus(submit.status);

  await persistProviderState({
    releaseId,
    providerKey: submit.providerKey,
    externalReference: submit.externalReference,
    status,
    raw: submit.raw,
  });

  await completeStatusEffects(
    releaseId,
    status,
    submit.externalReference,
    actorUserId,
  );

  return { status, externalReference: submit.externalReference };
}

export async function syncLedReleaseStatus(
  releaseId: string,
  actorUserId: string,
): Promise<{ status: QueueStatus; externalReference: string }> {
  const provider = getLedScreenProvider();
  if (provider.mode !== "api") {
    throw new Error("LED provider API mode is disabled.");
  }

  const release = await getReleaseQueueRow(releaseId);
  const externalReference = release.external_reference;
  if (!externalReference) {
    throw new Error("Release does not yet have a provider reference.");
  }

  const statusResult: LedStatusResult =
    await provider.getCampaignStatus(externalReference);
  const status = mapProviderStatus(statusResult.status);

  await persistProviderState({
    releaseId,
    providerKey: statusResult.providerKey,
    externalReference,
    status,
    raw: statusResult.raw,
    note: statusResult.message,
  });

  await completeStatusEffects(
    releaseId,
    status,
    externalReference,
    actorUserId,
  );

  return { status, externalReference };
}

export async function cancelLedRelease(
  releaseId: string,
): Promise<{ status: QueueStatus; externalReference: string }> {
  const provider = getLedScreenProvider();
  if (provider.mode !== "api") {
    throw new Error("LED provider API mode is disabled.");
  }

  const release = await getReleaseQueueRow(releaseId);
  const externalReference = release.external_reference;
  if (!externalReference) {
    throw new Error("Release does not yet have a provider reference.");
  }

  const cancelled = await provider.cancelCampaign(externalReference);
  const status = mapProviderStatus(cancelled.status);

  await persistProviderState({
    releaseId,
    providerKey: cancelled.providerKey,
    externalReference,
    status,
    raw: cancelled.raw,
    note: cancelled.message,
  });

  return { status, externalReference };
}

export async function processLedReleaseQueue(
  limit = 10,
  actorUserId = "04fcfe2a-0078-46c6-8828-2d93ccf8a454",
) {
  const provider = getLedScreenProvider();
  if (provider.mode !== "api") {
    return {
      skipped: true,
      reason: "LED provider API mode is disabled.",
      claimed: 0,
      results: [] as Array<Record<string, unknown>>,
    };
  }

  const admin = createSupabaseAdminClient();
  const cappedLimit = Math.max(1, Math.min(limit, 50));
  const { data, error } = await admin
    .from("asset_release_queue")
    .select("id,status")
    .in("status", [
      "pending",
      "submitted",
      "acknowledged",
      "processing",
      "released",
    ])
    .order("queued_at", { ascending: true })
    .limit(cappedLimit);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    status: QueueStatus;
  }>;
  const results: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    try {
      if (row.status === "pending") {
        const submitted = await submitLedRelease(
          row.id,
          actorUserId,
        );
        results.push({
          id: row.id,
          action: "submit",
          status: submitted.status,
          externalReference: submitted.externalReference,
        });
        continue;
      }

      const synced = await syncLedReleaseStatus(
        row.id,
        actorUserId,
      );
      results.push({
        id: row.id,
        action: "sync",
        status: synced.status,
        externalReference: synced.externalReference,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "LED release processing failed.";

      await admin
        .from("asset_release_queue")
        .update({
          status: "failed",
          attempts: 1,
          last_error: message,
          processing_started_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      results.push({
        id: row.id,
        action: "error",
        status: "failed",
        error: message,
      });
    }
  }

  return {
    skipped: false,
    claimed: rows.length,
    results,
  };
}