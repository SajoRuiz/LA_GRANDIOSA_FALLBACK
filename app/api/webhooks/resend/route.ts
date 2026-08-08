import { NextRequest, NextResponse } from "next/server";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ResendWebhookEvent = {
  type?: string;
  data?: {
    email_id?: string;
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const config = getCommerceServerConfig();
    if (!config.resendApiKey || !config.resendWebhookSecret) {
      return NextResponse.json({ error: "Resend webhook is not configured." }, { status: 503 });
    }

    const payload = await request.text();
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");

    if (!id || !timestamp || !signature) {
      return new NextResponse("Missing webhook headers", { status: 400 });
    }

    let event: ResendWebhookEvent = {};
    try {
      event = JSON.parse(payload) as ResendWebhookEvent;
    } catch {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }

    const messageId = event?.data?.email_id ?? event?.data?.id;
    if (messageId) {
      const admin = createSupabaseAdminClient();
      await admin.from("notification_outbox").update({
        provider_status: String(event.type ?? "unknown"),
        provider_payload: event,
        delivered_at: event.type === "email.delivered" ? new Date().toISOString() : undefined,
        last_error: ["email.bounced", "email.failed", "email.complained"].includes(event.type ?? "") ? String(event.type) : null,
      }).eq("provider", "resend").eq("provider_message_id", String(messageId));
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Resend webhook." }, { status: 400 });
  }
}
