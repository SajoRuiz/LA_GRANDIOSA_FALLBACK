import { NextResponse } from "next/server";

import { getCommerceServerConfig } from "@/lib/server/config";
import { getStage6SecurityReport } from "@/lib/server/security";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getCommerceServerConfig();
    const report = await getStage6SecurityReport();
    const admin = createSupabaseAdminClient();

    const [openChecksResult, deadLettersResult] =
      await Promise.all([
        admin
          .from("launch_checklist_items")
          .select("id")
          .eq("required", true)
          .not("status", "in", "(passed,waived)"),
        admin
          .from("notification_outbox")
          .select("id")
          .eq("status", "dead_letter"),
      ]);

    if (openChecksResult.error) {
      throw new Error(openChecksResult.error.message);
    }

    if (deadLettersResult.error) {
      throw new Error(deadLettersResult.error.message);
    }

    const requiredLaunchChecksOpen =
      openChecksResult.data?.length ??
      report.requiredLaunchChecksOpen;
    const deadLetterNotifications =
      deadLettersResult.data?.length ??
      report.deadLetterNotifications;

    const { data: buckets } = await admin.storage.listBuckets();
    const requiredBuckets = [
      "purchase-orders",
      "campaign-assets",
    ];
    const privateBucketsReady = requiredBuckets.every(
      (required) =>
        buckets?.some(
          (bucket) =>
            bucket.id === required && bucket.public === false,
        ),
    );

    const automaticBlockers = [
      report.rlsMissing.length > 0
        ? "critical_tables_missing_rls"
        : "",
      report.anonGrants.length > 0
        ? "anonymous_table_grants"
        : "",
      report.publicBuckets.length > 0
        ? "public_storage_buckets"
        : "",
      report.activeStaffWithoutVerifiedMfa > 0
        ? "staff_without_mfa"
        : "",
      report.activeBuyersWithoutVerifiedMfa > 0
        ? "buyers_without_mfa"
        : "",
      report.activeRemittanceAccounts !== 1
        ? "active_remittance_account_count"
        : "",
      !privateBucketsReady
        ? "required_private_storage_buckets"
        : "",
      !config.cronSecret ? "cron_secret_missing" : "",
      !(config.resendApiKey && config.resendWebhookSecret)
        ? "transactional_email_not_configured"
        : "",
      process.env.NODE_ENV === "production" &&
      !config.appBaseUrl.startsWith("https://")
        ? "production_app_url_not_https"
        : "",
      process.env.NODE_ENV === "production" &&
      config.securityHashSalt.length < 32
        ? "security_hash_salt_too_short"
        : "",
    ].filter(Boolean);

    const launchReady =
      automaticBlockers.length === 0 &&
      requiredLaunchChecksOpen === 0;

    return NextResponse.json(
      {
        ok: true,
        stage: "6",
        environment:
          process.env.NODE_ENV === "production"
            ? "production"
            : "development",
        launchReady,
        automaticBlockers,
        requiredLaunchChecksOpen,
        security: {
          rlsMissing: report.rlsMissing.length,
          anonGrants: report.anonGrants.length,
          publicBuckets: report.publicBuckets.length,
          staffWithoutMfa:
            report.activeStaffWithoutVerifiedMfa,
          buyersWithoutMfa:
            report.activeBuyersWithoutVerifiedMfa,
        },
        operations: {
          deadLetterNotifications,
          failedReleaseQueueItems:
            report.failedReleaseQueueItems,
          overdueInvoices: report.overdueInvoices,
          activeRemittanceAccounts:
            report.activeRemittanceAccounts,
        },
        providers: {
          email:
            config.resendApiKey && config.resendWebhookSecret
              ? "configured"
              : "queue only",
          sms:
            config.twilioAccountSid &&
            config.twilioAuthToken &&
            (config.twilioMessagingServiceSid ||
              config.twilioFromNumber)
              ? "configured"
              : "not configured / waivable",
          led: config.ledProviderMode,
        },
      },
      { status: launchReady ? 200 : 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "6",
        launchReady: false,
        error:
          error instanceof Error
            ? error.message
            : "Production readiness check failed.",
      },
      { status: 503 },
    );
  }
}
