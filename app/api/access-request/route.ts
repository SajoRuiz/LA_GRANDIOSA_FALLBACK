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

    const config = getCommerceServerConfig();
    const admin = createSupabaseAdminClient();

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
        template_key: "customer_access_request_received",
        recipient: email,
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        payload: {
          portalUrl: `${config.appBaseUrl}/auth/login`,
        },
      },
    ]);

    return NextResponse.redirect(new URL("/?accessRequest=sent", request.url));
  } catch (error) {
    console.error("Access request failed.", error);
    return NextResponse.redirect(new URL("/?accessRequest=invalid", request.url));
  }
}
