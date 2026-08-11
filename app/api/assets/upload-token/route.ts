import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AgencyAccessError } from "@/lib/auth/access";
import { CAMPAIGN_ASSET_BUCKET, cleanAssetFilename, requireAssetSlotViewer } from "@/lib/server/assets";
import { getCommerceServerConfig } from "@/lib/server/config";
import { getRouteRequestContext } from "@/lib/server/request-context";
import {
  enforceRateLimit,
  RateLimitExceededError,
} from "@/lib/server/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const slotId = String(body.slotId ?? "");
    const filename = cleanAssetFilename(String(body.filename ?? "creative"));
    const mimeType = String(body.mimeType ?? "");
    const fileSize = Number(body.fileSize ?? 0);
    const viewer = await requireAssetSlotViewer(slotId);
    if (viewer.isStaff) throw new AgencyAccessError("Agency upload access is required.", 403, "AGENCY_UPLOAD_REQUIRED");

    const requestContext = getRouteRequestContext(request);
    await enforceRateLimit({
      scope: "asset_upload_token_user",
      identifier: viewer.userId,
      limit: 120,
      windowSeconds: 60 * 60,
      context: requestContext,
      actorUserId: viewer.userId,
      actorEmail: viewer.email,
      failClosed: process.env.NODE_ENV === "production",
    });

    const spec = (viewer.slot.specification_snapshot ?? {}) as Record<string, unknown>;
    const allowed = Array.isArray(spec.allowedMimeTypes) ? spec.allowedMimeTypes.map(String) : [];
    const max = Number(spec.maxFileSizeBytes ?? 0);
    if (!allowed.includes(mimeType)) throw new Error(`File type ${mimeType || "unknown"} is not allowed.`);
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > max) throw new Error("File size is outside the allowed limit.");

    const admin = createSupabaseAdminClient();
    const storagePath = `${viewer.agencyId}/${viewer.orderId}/${viewer.slot.order_item_id}/${viewer.slot.screen_target}/${randomUUID()}-${filename}`;
    const { data, error } = await admin.storage.from(CAMPAIGN_ASSET_BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.token) throw new Error(error?.message ?? "Signed asset upload could not be created.");

    const config = getCommerceServerConfig();
    const projectRef = new URL(config.supabaseUrl).hostname.split(".")[0];
    return NextResponse.json({
      bucket: CAMPAIGN_ASSET_BUCKET,
      path: storagePath,
      token: data.token,
      endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`,
      chunkSize: 6 * 1024 * 1024,
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
    if (error instanceof AgencyAccessError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset upload preparation failed." }, { status: 400 });
  }
}
