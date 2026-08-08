export class CommerceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommerceConfigurationError";
  }
}

function requireServerEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    return "placeholder";
  }
  return value;
}

function optionalServerEnvironment(name: string): string {
  return process.env[name]?.trim() ?? "";
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
  notificationCronSecret: string;
}

export function getCommerceServerConfig(): CommerceServerConfig {
  return {
    appBaseUrl: process.env.APP_BASE_URL?.trim() || "http://localhost:3000",
    supabaseUrl: requireServerEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: requireServerEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    internalProcessingEmail: requireServerEnvironment("INTERNAL_PROCESSING_EMAIL"),
    salesReplyToEmail: requireServerEnvironment("SALES_REPLY_TO_EMAIL"),
    transactionalFromEmail: requireServerEnvironment("TRANSACTIONAL_FROM_EMAIL"),
    resendApiKey: optionalServerEnvironment("RESEND_API_KEY"),
    resendWebhookSecret: optionalServerEnvironment("RESEND_WEBHOOK_SECRET"),
    twilioAccountSid: optionalServerEnvironment("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: optionalServerEnvironment("TWILIO_AUTH_TOKEN"),
    twilioFromNumber: optionalServerEnvironment("TWILIO_FROM_NUMBER"),
    notificationCronSecret: optionalServerEnvironment("NOTIFICATION_CRON_SECRET"),
  };
}
