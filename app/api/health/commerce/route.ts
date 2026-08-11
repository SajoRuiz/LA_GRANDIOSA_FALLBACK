import { NextResponse } from "next/server";

import {
  CommerceConfigurationError,
  getCommerceServerConfig,
} from "@/lib/server/config";
import { getStage6SecurityReport } from "@/lib/server/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getCommerceServerConfig();
    const supabase = createSupabaseAdminClient();

    const checks = await Promise.all([
      supabase.from("orders").select("id,asset_due_at").limit(1),
      supabase.from("notification_outbox").select("id,max_attempts").limit(1),
      supabase.from("asset_submissions").select("id").limit(1),
      supabase.from("security_events").select("id").limit(1),
      supabase.from("rate_limit_buckets").select("key_hash").limit(1),
      supabase.from("launch_checklist_items").select("id").limit(1),
    ]);
    const failed = checks.find((result) => result.error);

    if (failed?.error) {
      return NextResponse.json(
        {
          ok: false,
          stage: "6",
          database: "unavailable",
          message:
            "Supabase is reachable, but the Stage 6 production-security migration may not be installed.",
          detail: failed.error.message,
        },
        { status: 503 },
      );
    }

    const [{ data: buckets }, report] = await Promise.all([
      supabase.storage.listBuckets(),
      getStage6SecurityReport(),
    ]);

    const campaignStorageReady =
      buckets?.some(
        (bucket) =>
          bucket.id === "campaign-assets" &&
          bucket.public === false,
      ) ?? false;

    const purchaseOrderStorageReady =
      buckets?.some(
        (bucket) =>
          bucket.id === "purchase-orders" &&
          bucket.public === false,
      ) ?? false;

    const emailConfigured = Boolean(
      config.resendApiKey && config.resendWebhookSecret,
    );
    const smsConfigured = Boolean(
      config.twilioAccountSid &&
        config.twilioAuthToken &&
        (config.twilioMessagingServiceSid ||
          config.twilioFromNumber),
    );

    return NextResponse.json({
      ok: true,
      stage: "6",
      database: "ready",
      authentication: "invite-only email/password + TOTP MFA",
      agencyPricing: "active",
      creditControls: "active",
      purchaseOrders: "active",
      invoicing: "active",
      assetRepository: "active",
      assetReview: "active",
      releaseQueue:
        config.ledProviderMode === "manual"
          ? "manual pending LED API"
          : "API adapter selected",
      campaignAssetStorage: campaignStorageReady
        ? "ready"
        : "missing",
      purchaseOrderStorage: purchaseOrderStorageReady
        ? "ready"
        : "missing",
      emailDelivery: emailConfigured
        ? "configured"
        : "queue only",
      smsDelivery: smsConfigured
        ? "configured"
        : "queue only",
      reminders: "active",
      securityHeaders: "active",
      rateLimiting: "active",
      securityAudit: "active",
      launchCertification: "active",
      requiredLaunchChecksOpen:
        report.requiredLaunchChecksOpen,
      automationSecurity: config.cronSecret
        ? "configured"
        : "manual staff only",
      businessTimeZone: config.businessTimeZone,
      notificationBatchSize: config.notificationBatchSize,
      internalProcessingEmail:
        config.internalProcessingEmail,
      salesReplyToEmail: config.salesReplyToEmail,
      transactionalFromEmail:
        config.transactionalFromEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "6",
        database: "not_configured",
        message:
          error instanceof CommerceConfigurationError
            ? error.message
            : "Commerce health check failed.",
      },
      { status: 503 },
    );
  }
}
