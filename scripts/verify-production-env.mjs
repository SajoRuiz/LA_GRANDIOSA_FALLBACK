const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_BASE_URL",
  "INTERNAL_PROCESSING_EMAIL",
  "SALES_REPLY_TO_EMAIL",
  "TRANSACTIONAL_FROM_EMAIL",
  "CRON_SECRET",
  "SECURITY_HASH_SALT",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
];

const optionalGroups = [
  {
    name: "Twilio SMS",
    keys: [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_AUTH_TOKEN",
    ],
    alternatives: [
      "TWILIO_MESSAGING_SERVICE_SID",
      "TWILIO_FROM_NUMBER",
    ],
  },
];

const placeholderValues = new Set([
  "YOUR_SUPABASE_PUBLISHABLE_KEY",
  "YOUR_SUPABASE_SERVICE_ROLE_KEY",
  "local-test-key",
  "local-test-secret",
  "local-webhook-secret",
  "generated-value",
  "your-cron-secret",
]);

function looksLikePlaceholder(name, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return false;

  if (placeholderValues.has(value)) {
    return true;
  }

  if (value.includes("YOUR_PROJECT") || value.includes("your-domain.example")) {
    return true;
  }

  if (/^YOUR_[A-Z0-9_]+$/.test(value)) {
    return true;
  }

  if (name === "APP_BASE_URL" && value.includes("localhost")) {
    return true;
  }

  return false;
}

const missing = required.filter(
  (name) => !String(process.env[name] ?? "").trim(),
);
const errors = [];
const warnings = [];

const appBaseUrl = String(process.env.APP_BASE_URL ?? "").trim();
if (appBaseUrl && !appBaseUrl.startsWith("https://")) {
  errors.push("APP_BASE_URL must use HTTPS in production.");
}

for (const name of [...required, "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID", "TWILIO_FROM_NUMBER", "LED_PROVIDER_API_BASE_URL", "LED_PROVIDER_API_KEY", "LED_PROVIDER_API_SECRET", "LED_PROVIDER_WEBHOOK_SECRET"]) {
  if (looksLikePlaceholder(name, process.env[name])) {
    errors.push(`${name} looks like a placeholder or local-only value.`);
  }
}

const securitySalt = String(
  process.env.SECURITY_HASH_SALT ?? "",
);
if (securitySalt && securitySalt.length < 32) {
  errors.push(
    "SECURITY_HASH_SALT must contain at least 32 characters.",
  );
}

const cronSecret = String(process.env.CRON_SECRET ?? "").trim();
if (cronSecret && cronSecret.length < 32) {
  errors.push("CRON_SECRET must contain at least 32 characters.");
}

const resendApiKey = String(process.env.RESEND_API_KEY ?? "").trim();
if (resendApiKey && !/^re_[A-Za-z0-9_-]{10,}$/.test(resendApiKey)) {
  errors.push("RESEND_API_KEY does not match the expected Resend format.");
}

const resendWebhookSecret = String(process.env.RESEND_WEBHOOK_SECRET ?? "").trim();
if (
  resendWebhookSecret &&
  !/^whsec_[A-Za-z0-9_-]{10,}$/.test(resendWebhookSecret)
) {
  errors.push(
    "RESEND_WEBHOOK_SECRET does not match the expected Resend format.",
  );
}

for (const emailKey of [
  "INTERNAL_PROCESSING_EMAIL",
  "SALES_REPLY_TO_EMAIL",
  "TRANSACTIONAL_FROM_EMAIL",
]) {
  const value = String(process.env[emailKey] ?? "");
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors.push(`${emailKey} is not a valid email address.`);
  }
}

for (const group of optionalGroups) {
  const baseReady = group.keys.every((key) =>
    String(process.env[key] ?? "").trim(),
  );
  const senderReady = group.alternatives.some((key) =>
    String(process.env[key] ?? "").trim(),
  );

  if (!baseReady || !senderReady) {
    warnings.push(
      `${group.name} is not fully configured. It must be formally waived or completed before SMS launch.`,
    );
  }
}

const ledMode = String(
  process.env.LED_PROVIDER_MODE ?? "manual",
).trim();
if (!["manual", "api"].includes(ledMode)) {
  errors.push("LED_PROVIDER_MODE must be manual or api.");
}

if (
  ledMode === "api" &&
  (!String(process.env.LED_PROVIDER_API_BASE_URL ?? "").trim() ||
    !String(process.env.LED_PROVIDER_API_KEY ?? "").trim() ||
    !String(process.env.LED_PROVIDER_API_SECRET ?? "").trim() ||
    !String(process.env.LED_PROVIDER_WEBHOOK_SECRET ?? "").trim())
) {
  errors.push(
    "LED API mode requires LED_PROVIDER_API_BASE_URL, LED_PROVIDER_API_KEY, LED_PROVIDER_API_SECRET, and LED_PROVIDER_WEBHOOK_SECRET.",
  );
}

console.log("La Grandiosa production environment review");
console.log("================================================");

for (const name of required) {
  console.log(
    `${String(process.env[name] ?? "").trim() ? "PASS" : "MISS"}  ${name}`,
  );
}

for (const warning of warnings) {
  console.warn(`WARN  ${warning}`);
}

for (const error of errors) {
  console.error(`FAIL  ${error}`);
}

if (missing.length || errors.length) {
  console.error(
    `\nProduction environment failed: ${missing.length} missing variable(s), ${errors.length} validation error(s).`,
  );
  process.exit(1);
}

console.log("\nProduction environment passed required checks.");
