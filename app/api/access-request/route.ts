import { NextRequest, NextResponse } from "next/server";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processNotificationOutbox } from "@/lib/server/notification-delivery";

export const runtime = "nodejs";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function slugUsername(value: string) {
  const local = value.split("@")[0] ?? "";
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (cleaned.length >= 3) {
    return cleaned.slice(0, 40);
  }

  return `client-${crypto.randomUUID().slice(0, 8)}`;
}

async function nextAvailableUsername(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
) {
  const base = slugUsername(email);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${crypto.randomUUID().slice(0, 4)}`;
    const candidate = `${base}${suffix}`.slice(0, 40);
    const { data } = await admin
      .from("user_profiles")
      .select("user_id")
      .eq("username", candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
  }

  return `client-${crypto.randomUUID().slice(0, 12)}`;
}

function isValidPasswordCandidate(value: string) {
  return typeof value === "string" && value.length >= 12;
}

function resolveReturnPath(value: string, fallback = "/auth/signup") {
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const name = String(formData.get("name") ?? "").trim();
    const email = normalizeEmail(String(formData.get("email") ?? ""));
    const company = String(formData.get("company") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const returnTo = resolveReturnPath(
      String(formData.get("returnTo") ?? ""),
      "/auth/signup",
    );

    if (!email || !isValidEmail(email)) {
      return NextResponse.redirect(
        new URL(`${returnTo}?accessRequest=invalid`, request.url),
      );
    }

    const config = getCommerceServerConfig();
    const admin = createSupabaseAdminClient();
    const dedupeBase = normalizeEmail(email).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.redirect(
        new URL(`${returnTo}?accessRequest=exists`, request.url),
      );
    }

    await admin.from("access_leads").insert({
      requester_name: name || null,
      requester_email: email,
      company_name: company || null,
      message: message || null,
      source: "homepage_access_request",
      status: "contacted",
    });

    const agencyName = company || `${name || "New"} Agency`;

    await admin.from("notification_outbox").insert([
      {
        channel: "email",
        template_key: "internal_new_client_credit_assignment_required",
        recipient: config.internalProcessingEmail,
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key: `access-request-internal-${dedupeBase}-${crypto.randomUUID().slice(0, 8)}`,
        priority: 10,
        payload: {
          requesterName: name,
          requesterEmail: email,
          agencyAccountNumber: "PENDING",
          agencyName,
          company,
          message,
          portalUrl: `${config.appBaseUrl}/admin/agencies/credit`,
        },
      },
      {
        channel: "email",
        template_key: "customer_access_request_received",
        recipient: email,
        sender_email: config.transactionalFromEmail,
        reply_to_email: config.salesReplyToEmail,
        dedupe_key: `access-request-customer-${dedupeBase}-${crypto.randomUUID().slice(0, 8)}`,
        priority: 10,
        payload: {
          requesterName: name,
          agencyName,
          portalUrl: `${config.appBaseUrl}/auth/login`,
        },
      },
    ]);

    // Kick the outbox worker immediately so access-request notifications
    // do not depend solely on cron cadence.
    try {
      await processNotificationOutbox(2);
    } catch (deliveryError) {
      console.error("Access-request notification processing failed.", deliveryError);
    }

    return NextResponse.redirect(
      new URL(`${returnTo}?accessRequest=sent`, request.url),
    );
  } catch (error) {
    console.error("Access request failed.", error);
    return NextResponse.redirect(
      new URL("/auth/signup?accessRequest=invalid", request.url),
    );
  }
}
