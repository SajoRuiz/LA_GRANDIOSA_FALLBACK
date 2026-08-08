export class CommerceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommerceConfigurationError";
  }
}

function requireServerEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new CommerceConfigurationError(
      `Missing required server environment variable: ${name}`,
    );
  }
  return value;
}

function optionalServerEnvironment(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function optionalInteger(name: string, fallback: number): number {
  const raw = optionalServerEnvironment(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export interface CommerceServerConfig {
  appBaseUrl: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  internalProcessingEmail: string;
  salesReplyToEmail: string;
  transactionalFromEmail: string;
  resendApiKey: string;
  resendWebhookSecret: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  twilioMessagingServiceSid: string;
  twilioStatusCallbackUrl: string;
  cronSecret: string;
  /** Backward-compatible alias used by the Stage 4 worker. */
  notificationCronSecret: string;
  businessTimeZone: string;
  notificationBatchSize: number;
}

export function getCommerceServerConfig(): CommerceServerConfig {
  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  const cronSecret =
    optionalServerEnvironment("CRON_SECRET") ||
    optionalServerEnvironment("NOTIFICATION_CRON_SECRET");

  return {
    appBaseUrl,
    supabaseUrl: requireServerEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: requireServerEnvironment(
      "SUPABASE_SERVICE_ROLE_KEY",
    ),
    internalProcessingEmail: requireServerEnvironment(
      "INTERNAL_PROCESSING_EMAIL",
    ),
    salesReplyToEmail: requireServerEnvironment("SALES_REPLY_TO_EMAIL"),
    transactionalFromEmail: requireServerEnvironment(
      "TRANSACTIONAL_FROM_EMAIL",
    ),
    resendApiKey: optionalServerEnvironment("RESEND_API_KEY"),
    resendWebhookSecret: optionalServerEnvironment(
      "RESEND_WEBHOOK_SECRET",
    ),
    twilioAccountSid: optionalServerEnvironment("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: optionalServerEnvironment("TWILIO_AUTH_TOKEN"),
    twilioFromNumber: optionalServerEnvironment("TWILIO_FROM_NUMBER"),
    twilioMessagingServiceSid: optionalServerEnvironment(
      "TWILIO_MESSAGING_SERVICE_SID",
    ),
    twilioStatusCallbackUrl:
      optionalServerEnvironment("TWILIO_STATUS_CALLBACK_URL") ||
      `${appBaseUrl}/api/webhooks/twilio/status`,
    cronSecret,
    notificationCronSecret: cronSecret,
    businessTimeZone:
      optionalServerEnvironment("BUSINESS_TIME_ZONE") ||
      "America/Puerto_Rico",
    notificationBatchSize: optionalInteger("NOTIFICATION_BATCH_SIZE", 25),
  };
}
