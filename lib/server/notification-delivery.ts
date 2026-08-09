import twilio from "twilio";
import { getCommerceServerConfig } from "@/lib/server/config";
import { renderNotification } from "@/lib/server/notification-templates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface OutboxRow {
  id: string;
  channel: "email" | "sms";
  template_key: string;
  recipient: string;
  sender_email: string | null;
  reply_to_email: string | null;
  payload: Record<string, unknown>;
}

interface ResendSendResponse {
  id?: string;
  message?: string;
  name?: string;
}

export async function sendEmail(row: OutboxRow) {
  const config = getCommerceServerConfig();

  if (!config.resendApiKey) {
    return {
      skipped: true as const,
      reason: "RESEND_API_KEY is not configured.",
    };
  }

  const rendered = renderNotification(
    row.template_key,
    row.payload ?? {},
  );

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `notification-${row.id}`,
    },
    body: JSON.stringify({
      from: `La Grandiosa <${
        row.sender_email || config.transactionalFromEmail
      }>`,
      to: [row.recipient],
      reply_to: row.reply_to_email || config.salesReplyToEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [
        { name: "template", value: row.template_key.slice(0, 256) },
        { name: "notification", value: row.id.replaceAll("-", "") },
      ],
    }),
  });

  const result = (await response.json().catch(() => ({}))) as
    ResendSendResponse;

  if (!response.ok || !result.id) {
    throw new Error(
      result.message ||
        result.name ||
        `Resend returned HTTP ${response.status}.`,
    );
  }

  return {
    skipped: false as const,
    provider: "resend",
    messageId: result.id,
    providerStatus: "accepted",
    providerPayload: result,
  };
}

async function sendSms(row: OutboxRow) {
  const config = getCommerceServerConfig();

  if (!config.twilioAccountSid || !config.twilioAuthToken) {
    return {
      skipped: true as const,
      reason: "Twilio account credentials are not configured.",
    };
  }

  if (!config.twilioMessagingServiceSid && !config.twilioFromNumber) {
    return {
      skipped: true as const,
      reason:
        "Configure TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER.",
    };
  }

  const rendered = renderNotification(
    row.template_key,
    row.payload ?? {},
  );
  const client = twilio(
    config.twilioAccountSid,
    config.twilioAuthToken,
  );

  const message = await client.messages.create({
    body: rendered.sms,
    to: row.recipient,
    statusCallback: config.twilioStatusCallbackUrl,
    validityPeriod: 3600,
    ...(config.twilioMessagingServiceSid
      ? { messagingServiceSid: config.twilioMessagingServiceSid }
      : { from: config.twilioFromNumber }),
  });

  return {
    skipped: false as const,
    provider: "twilio",
    messageId: message.sid,
    providerStatus: message.status,
    providerPayload: {
      sid: message.sid,
      status: message.status,
      messagingServiceSid: message.messagingServiceSid,
      from: message.from,
      to: message.to,
    },
  };
}

export async function processNotificationOutbox(limit = 20) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "claim_notification_batch",
    { p_limit: limit },
  );

  if (error) {
    throw new Error(error.message);
  }

  const rows = (Array.isArray(data) ? data : []) as OutboxRow[];
  const results: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    try {
      const delivery =
        row.channel === "email"
          ? await sendEmail(row)
          : await sendSms(row);

      if (delivery.skipped) {
        await admin.rpc("defer_notification", {
          p_notification_id: row.id,
          p_reason: delivery.reason,
          p_retry_after_seconds: 3600,
        });
        results.push({
          id: row.id,
          status: "deferred",
          reason: delivery.reason,
        });
        continue;
      }

      const { error: sentError } = await admin.rpc(
        "mark_notification_sent",
        {
          p_notification_id: row.id,
          p_provider: delivery.provider,
          p_provider_message_id: delivery.messageId,
          p_provider_status: delivery.providerStatus,
          p_provider_payload: delivery.providerPayload,
        },
      );

      if (sentError) {
        throw new Error(sentError.message);
      }

      results.push({
        id: row.id,
        status: "sent",
        provider: delivery.provider,
        messageId: delivery.messageId,
      });
    } catch (deliveryError) {
      const message =
        deliveryError instanceof Error
          ? deliveryError.message
          : "Notification delivery failed.";

      await admin.rpc("mark_notification_failed", {
        p_notification_id: row.id,
        p_error: message,
        p_retry_after_seconds: null,
      });

      results.push({
        id: row.id,
        status: "failed",
        error: message,
      });
    }
  }

  return {
    claimed: rows.length,
    results,
  };
}
