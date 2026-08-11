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

const missing = required.filter(
  (name) => !String(process.env[name] ?? "").trim(),
);
const errors = [];
const warnings = [];

const appBaseUrl = String(process.env.APP_BASE_URL ?? "").trim();
if (appBaseUrl && !appBaseUrl.startsWith("https://")) {
  errors.push("APP_BASE_URL must use HTTPS in production.");
}

const securitySalt = String(
  process.env.SECURITY_HASH_SALT ?? "",
);
if (securitySalt && securitySalt.length < 32) {
  errors.push(
    "SECURITY_HASH_SALT must contain at least 32 characters.",
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
    !String(process.env.LED_PROVIDER_API_KEY ?? "").trim())
) {
  errors.push(
    "LED API mode requires LED_PROVIDER_API_BASE_URL and LED_PROVIDER_API_KEY.",
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
