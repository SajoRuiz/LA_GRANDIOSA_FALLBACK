import { NextRequest, NextResponse } from "next/server";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "").trim();
    const email = normalizeEmail(String(formData.get("email") ?? ""));
    const company = String(formData.get("company") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    if (!email || !isValidEmail(email)) {
      return NextResponse.redirect(new URL("/?accessRequest=invalid", request.url));
    }

    const admin = createSupabaseAdminClient();
    const salesRecipient = process.env.SALES_REPLY_TO_EMAIL?.trim() || "ventas@lagrandiosapr.com";
    const transactionalFromEmail = process.env.TRANSACTIONAL_FROM_EMAIL?.trim() || "no-reply@lagrandiosapr.com";
    const appBaseUrl = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
    const dedupeBase = normalizeEmail(email).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    await admin.from("access_leads").insert({
      requester_name: name || null,
      requester_email: email,
      company_name: company || null,
      message: message || null,
      source: "homepage_access_request",
      status: "new",
    });

    await admin.from("notification_outbox").insert([
      {
        channel: "email",
        template_key: "internal_access_request_received",
        recipient: salesRecipient,
        sender_email: transactionalFromEmail,
        reply_to_email: salesRecipient,
        dedupe_key: `access-request-internal-${dedupeBase}`,
        payload: {
          requesterName: name,
          requesterEmail: email,
          company,
          message,
        },
      },
      {
        channel: "email",
        template_key: "customer_access_request_received",
        recipient: email,
        sender_email: transactionalFromEmail,
        reply_to_email: salesRecipient,
        dedupe_key: `access-request-customer-${dedupeBase}`,
        payload: {
          portalUrl: `${appBaseUrl}/auth/login`,
        },
      },
    ]);

    return NextResponse.redirect(new URL("/?accessRequest=sent", request.url));
  } catch (error) {
    console.error("Access request failed.", error);
    return NextResponse.redirect(new URL("/?accessRequest=invalid", request.url));
  }
}
