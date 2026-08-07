import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CommerceConfigurationError,
  getCommerceServerConfig,
} from "@/lib/server/config";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = getCommerceServerConfig();
    const supabase = createSupabaseAdminClient();

    const tableChecks = await Promise.all([
      supabase.from("orders").select("id").limit(1),
      supabase.from("agency_accounts").select("id").limit(1),
      supabase.from("agency_credit_holds").select("id").limit(1),
      supabase.from("agency_credit_reviews").select("id").limit(1),
      supabase.from("agency_credit_ledger").select("id").limit(1),
    ]);

    const failed = tableChecks.find((result) => result.error);

    if (failed?.error) {
      return NextResponse.json(
        {
          ok: false,
          stage: "3B-B",
          database: "unavailable",
          message:
            "Supabase is reachable, but the Stage 3B-B pricing and credit migration may not be installed.",
          detail: failed.error.message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      stage: "3B-B",
      database: "ready",
      authentication: "invite-only email/password + TOTP MFA",
      agencyPricing: "active",
      creditControls: "active",
      internalProcessingEmail: config.internalProcessingEmail,
      salesReplyToEmail: config.salesReplyToEmail,
      transactionalFromEmail: config.transactionalFromEmail,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        stage: "3B-B",
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
