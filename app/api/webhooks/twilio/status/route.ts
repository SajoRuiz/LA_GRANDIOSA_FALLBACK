import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const config = getCommerceServerConfig();
  if (!config.twilioAuthToken) return NextResponse.json({ error: "Twilio webhook is not configured." }, { status: 503 });
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => { params[key] = String(value); });
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const publicUrl = `${config.appBaseUrl}/api/webhooks/twilio/status`;
  if (!twilio.validateRequest(config.twilioAuthToken, signature, publicUrl, params)) return new NextResponse("Invalid signature", { status: 403 });
  const sid = params.MessageSid;
  const status = params.MessageStatus;
  if (sid) {
    const admin = createSupabaseAdminClient();
    await admin.from("notification_outbox").update({
      provider_status: status,
      provider_payload: params,
      delivered_at: status === "delivered" ? new Date().toISOString() : undefined,
      last_error: ['failed','undelivered'].includes(status) ? params.ErrorCode || status : null,
    }).eq("provider", "twilio").eq("provider_message_id", sid);
  }
  return new NextResponse(null, { status: 204 });
}
