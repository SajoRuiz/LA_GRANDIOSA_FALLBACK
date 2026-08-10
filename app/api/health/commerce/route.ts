import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CommerceConfigurationError,
  getCommerceServerConfig,
} from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getCommerceServerConfig();
    const supabase = createSupabaseAdminClient();

    const checks = await Promise.all([
      supabase.from("orders").select("id,asset_due_at").limit(1),
      supabase.from("notification_outbox").select("id,max_attempts").limit(1),
      supabase.from("notification_provider_events").select("id").limit(1),
      supabase.from("notification_suppressions").select("id").limit(1),
      supabase.from("automation_job_locks").select("job_key").limit(1),
      supabase.from("asset_submissions").select("id").limit(1),
    ]);
    const failed = checks.find((result) => result.error);

    if (failed?.error) {
      return NextResponse.json(
        {
          ok: false,
          stage: "5",
          database: "unavailable",
          message:
            "Supabase is reachable, but the Stage 5 communications migration may not be installed.",
          detail: failed.error.message,
        },
        { status: 503 },
      );
    }

    const { data: buckets } = await supabase.storage.listBuckets();
    const campaignStorageReady =
      buckets?.some((bucket) => bucket.id === "campaign-assets") ?? false;

    const emailConfigured = Boolean(
      config.resendApiKey && config.resendWebhookSecret,
    );
    return NextResponse.json({
      ok: true,
      stage: "5",
      database: "ready",
      authentication: "invite-only email/password + TOTP MFA",
      agencyPricing: "active",
      creditControls: "active",
      purchaseOrders: "active",
      invoicing: "active",
      assetRepository: "active",
      assetReview: "active",
      releaseQueue: "manual pending LED API",
      campaignAssetStorage: campaignStorageReady ? "ready" : "missing",
      emailDelivery: emailConfigured ? "configured" : "queue only",
      smsDelivery: "disabled",
      reminders: "active",
      automationSecurity: config.cronSecret ? "configured" : "manual staff only",
      businessTimeZone: config.businessTimeZone,
      notificationBatchSize: config.notificationBatchSize,
      internalProcessingEmail: config.internalProcessingEmail,
      salesReplyToEmail: config.salesReplyToEmail,
      transactionalFromEmail: config.transactionalFromEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "5",
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
