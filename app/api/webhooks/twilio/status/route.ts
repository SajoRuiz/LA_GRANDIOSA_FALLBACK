import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function eventId(params: Record<string, string>): string {
  return createHash("sha256")
    .update(
      [
        params.MessageSid ?? "",
        params.MessageStatus ?? "",
        params.ErrorCode ?? "",
        params.RawDlrDoneDate ?? "",
      ].join("|"),
    )
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const config = getCommerceServerConfig();

    if (!config.twilioAuthToken) {
      return NextResponse.json(
        { error: "Twilio webhook is not configured." },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const params: Record<string, string> = {};
    form.forEach((value, key) => {
      params[key] = String(value);
    });

    const signature =
      request.headers.get("x-twilio-signature") ?? "";
    const callbackUrl = config.twilioStatusCallbackUrl;

    if (
      !twilio.validateRequest(
        config.twilioAuthToken,
        signature,
        callbackUrl,
        params,
      )
    ) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const sid = params.MessageSid ?? params.SmsSid ?? "";
    const status = params.MessageStatus ?? params.SmsStatus ?? "unknown";

    if (sid) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.rpc(
        "record_notification_provider_event",
        {
          p_provider: "twilio",
          p_provider_event_id: eventId(params),
          p_provider_message_id: sid,
          p_event_type: status,
          p_error_code: params.ErrorCode ?? "",
          p_payload: params,
          p_occurred_at: null,
        },
      );

      if (error) {
        throw new Error(error.message);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Twilio status processing failed.",
      },
      { status: 400 },
    );
  }
}
