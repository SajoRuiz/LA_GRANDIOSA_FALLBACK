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
      supabase.from("orders").select("id").limit(1),
      supabase.from("agency_credit_holds").select("id").limit(1),
      supabase.from("purchase_orders").select("id").limit(1),
      supabase.from("invoices").select("id").limit(1),
      supabase.from("remittance_accounts").select("id").limit(1),
    ]);
    const failed = checks.find((result) => result.error);

    if (failed?.error) {
      return NextResponse.json(
        {
          ok: false,
          stage: "3B-C",
          database: "unavailable",
          message:
            "Supabase is reachable, but the Stage 3B-C PO and invoicing migration may not be installed.",
          detail: failed.error.message,
        },
        { status: 503 },
      );
    }

    const { data: buckets } = await supabase.storage.listBuckets();
    const poBucketReady =
      buckets?.some((bucket) => bucket.id === "purchase-orders") ??
      false;

    return NextResponse.json({
      ok: true,
      stage: "3B-C",
      database: "ready",
      authentication: "invite-only email/password + TOTP MFA",
      agencyPricing: "active",
      creditControls: "active",
      purchaseOrders: "active",
      invoicing: "active",
      remittanceVault: "active",
      purchaseOrderStorage: poBucketReady ? "ready" : "missing",
      notificationDelivery: "queued only",
      internalProcessingEmail: config.internalProcessingEmail,
      salesReplyToEmail: config.salesReplyToEmail,
      transactionalFromEmail: config.transactionalFromEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "3B-C",
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
