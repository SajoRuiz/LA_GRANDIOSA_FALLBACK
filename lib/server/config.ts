export class CommerceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommerceConfigurationError";
  }
}

export interface CommerceServerConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  appBaseUrl: string;
  internalProcessingEmail: string;
  salesReplyToEmail: string;
  transactionalFromEmail: string;
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new CommerceConfigurationError(
      `Missing required environment variable: ${name}`,
    );
  }

  return value.trim();
}

export function getCommerceServerConfig(): CommerceServerConfig {
  return {
    supabaseUrl: requiredEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: requiredEnvironmentValue(
      "SUPABASE_SERVICE_ROLE_KEY",
    ),
    appBaseUrl: requiredEnvironmentValue("APP_BASE_URL"),
    internalProcessingEmail: requiredEnvironmentValue(
      "INTERNAL_PROCESSING_EMAIL",
    ),
    salesReplyToEmail: requiredEnvironmentValue("SALES_REPLY_TO_EMAIL"),
    transactionalFromEmail: requiredEnvironmentValue(
      "TRANSACTIONAL_FROM_EMAIL",
    ),
  };
}
