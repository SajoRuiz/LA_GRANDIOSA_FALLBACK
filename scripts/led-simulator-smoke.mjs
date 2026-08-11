const baseUrl = process.env.SIM_BASE_URL?.trim() || "http://localhost:3000";
const apiKey =
  process.env.SIM_API_KEY?.trim() ||
  process.env.LED_PROVIDER_API_KEY?.trim() ||
  "";
const webhookSecret =
  process.env.LED_PROVIDER_WEBHOOK_SECRET?.trim() || "";

if (!apiKey) {
  console.error("SIM_API_KEY or LED_PROVIDER_API_KEY is required.");
  process.exit(1);
}

const providerBase = new URL(
  "/api/internal/led/simulated-provider",
  baseUrl,
);
const webhookUrl = new URL("/api/webhooks/led/status", baseUrl);
const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

async function request(url, init = {}) {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const unique = Date.now();
  const release = {
    releaseId: `sim-release-${unique}`,
    orderId: "00000000-0000-0000-0000-000000000001",
    orderNumber: `SIM-${unique}`,
    startDate: "2026-08-11",
    endDate: "2026-08-18",
    assets: [
      {
        screenTarget: "center",
        signedDownloadUrl: "https://example.test/asset.mp4",
        filename: "demo.mp4",
        mimeType: "video/mp4",
        durationSeconds: 15,
      },
    ],
    metadata: { source: "led-simulator-smoke" },
  };

  const submitted = await request(new URL("/campaigns", providerBase), {
    method: "POST",
    headers,
    body: JSON.stringify(release),
  });
  console.log("submit", submitted);

  const campaignUrl = new URL(
    `/campaigns/${encodeURIComponent(submitted.externalReference)}`,
    providerBase,
  );
  const statusUrl = new URL(
    `/campaigns/${encodeURIComponent(submitted.externalReference)}/status`,
    providerBase,
  );

  console.log(
    "status",
    await request(campaignUrl, { method: "GET", headers }),
  );
  console.log(
    "released",
    await request(statusUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        status: "released",
        message: "Simulator release ok",
      }),
    }),
  );

  if (webhookSecret) {
    console.log(
      "webhook",
      await request(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-led-signature": webhookSecret,
        },
        body: JSON.stringify({
          providerKey: "simulated_led_provider",
          externalReference: submitted.externalReference,
          status: "live",
          message: "Simulator webhook marked campaign live.",
        }),
      }),
    );
  } else {
    console.log("webhook skipped: LED_PROVIDER_WEBHOOK_SECRET not set");
  }

  console.log(
    "cancel",
    await request(campaignUrl, { method: "DELETE", headers }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});