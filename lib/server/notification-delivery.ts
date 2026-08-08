import { Resend } from "resend";
import twilio from "twilio";
import { getCommerceServerConfig } from "@/lib/server/config";
import { renderNotification } from "@/lib/server/notification-templates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface OutboxRow {
  id: string;
  channel: "email" | "sms";
  template_key: string;
  recipient: string;
  sender_email: string | null;
  reply_to_email: string | null;
  payload: Record<string, unknown>;
}

export async function processNotificationOutbox(limit = 20) {
  const config = getCommerceServerConfig();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_notification_batch", { p_limit: limit });
  if (error) throw new Error(error.message);

  const rows = (Array.isArray(data) ? data : []) as OutboxRow[];
  const results: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    try {
      const rendered = renderNotification(row.template_key, row.payload ?? {});
      if (row.channel === "email") {
        if (!config.resendApiKey) throw new Error("RESEND_API_KEY is not configured.");
        const resend = new Resend(config.resendApiKey);
        const { data: sent, error: sendError } = await resend.emails.send({
          from: `La Grandiosa <${row.sender_email || config.transactionalFromEmail}>`,
          to: [row.recipient],
          replyTo: row.reply_to_email || config.salesReplyToEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        if (sendError) throw new Error(sendError.message);
        await admin.rpc("mark_notification_sent", {
          p_notification_id: row.id,
          p_provider: "resend",
          p_provider_message_id: sent?.id ?? "",
          p_provider_status: "accepted",
          p_provider_payload: sent ?? {},
        });
        results.push({ id: row.id, status: "sent", provider: "resend", messageId: sent?.id });
      } else {
        if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioFromNumber) {
          throw new Error("Twilio SMS credentials are not configured.");
        }
        const client = twilio(config.twilioAccountSid, config.twilioAuthToken);
        const message = await client.messages.create({
          body: rendered.sms,
          from: config.twilioFromNumber,
          to: row.recipient,
          statusCallback: `${config.appBaseUrl}/api/webhooks/twilio/status`,
        });
        await admin.rpc("mark_notification_sent", {
          p_notification_id: row.id,
          p_provider: "twilio",
          p_provider_message_id: message.sid,
          p_provider_status: message.status,
          p_provider_payload: { sid: message.sid, status: message.status },
        });
        results.push({ id: row.id, status: "sent", provider: "twilio", messageId: message.sid });
      }
    } catch (deliveryError) {
      const message = deliveryError instanceof Error ? deliveryError.message : "Notification delivery failed.";
      await admin.rpc("mark_notification_failed", {
        p_notification_id: row.id,
        p_error: message,
        p_retry_after_seconds: 300,
      });
      results.push({ id: row.id, status: "failed", error: message });
    }
  }

  return { claimed: rows.length, results };
}
