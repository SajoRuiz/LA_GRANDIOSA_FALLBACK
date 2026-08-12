const baseUrl = process.env.SIM_BASE_URL?.trim() || "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET?.trim() || "";
const callbackUrl = process.env.LED_CALLBACK_URL?.trim() || "";

if (!cronSecret) {
  console.error("CRON_SECRET is required for internal route authorization.");
  process.exit(1);
}

async function request(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const payload = callbackUrl ? { callbackUrl } : {};
  const result = await request(
    new URL("/api/internal/releases/subscribe", baseUrl),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  console.log("subscribe", result);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});