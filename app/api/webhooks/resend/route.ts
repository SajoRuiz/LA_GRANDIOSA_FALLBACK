import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const config = getCommerceServerConfig();

    if (!config.resendWebhookSecret) {
      return NextResponse.json(
        { error: "Resend webhook is not configured." },
        { status: 503 },
      );
    }

    const payload = await request.text();
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");

    if (!id || !timestamp || !signature) {
      return new NextResponse("Missing webhook headers", {
        status: 400,
      });
    }

    const verifier = new Webhook(config.resendWebhookSecret);
    const event = verifier.verify(payload, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as Record<string, any>;

    const messageId = String(
      event?.data?.email_id ?? event?.data?.id ?? "",
    );
    const eventType = String(event?.type ?? "unknown");
    const errorCode = String(
      event?.data?.bounce?.message ??
        event?.data?.error?.message ??
        event?.data?.reason ??
        "",
    );

    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc(
      "record_notification_provider_event",
      {
        p_provider: "resend",
        p_provider_event_id: id,
        p_provider_message_id: messageId,
        p_event_type: eventType,
        p_error_code: errorCode,
        p_payload: event,
        p_occurred_at: event?.created_at
          ? new Date(event.created_at).toISOString()
          : null,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid Resend webhook.",
      },
      { status: 400 },
    );
  }
}
