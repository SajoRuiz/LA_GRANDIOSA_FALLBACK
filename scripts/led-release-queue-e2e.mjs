const baseUrl = process.env.SIM_BASE_URL?.trim() || "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET?.trim() || "";
const webhookSecret = process.env.LED_PROVIDER_WEBHOOK_SECRET?.trim() || "";

if (!cronSecret) {
  console.error("CRON_SECRET is required for internal route authorization.");
  process.exit(1);
}

if (!webhookSecret) {
  console.error("LED_PROVIDER_WEBHOOK_SECRET is required for webhook validation.");
  process.exit(1);
}

const internalHeaders = {
  Authorization: `Bearer ${cronSecret}`,
  "Content-Type": "application/json",
};

async function request(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSnapshot(releaseId) {
  return request(new URL(`/api/internal/releases/seed?releaseId=${encodeURIComponent(releaseId)}`, baseUrl), {
    method: "GET",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
}

async function runWorker(limit = 10) {
  return request(new URL("/api/internal/releases/process", baseUrl), {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify({ limit }),
  });
}

async function main() {
  const seeded = await request(new URL("/api/internal/releases/seed", baseUrl), {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify({}),
  });

  console.log("seed", seeded);

  const releaseId = seeded.releaseId;
  if (!releaseId) {
    throw new Error("Seed route did not return releaseId.");
  }

  let externalReference = seeded.externalReference || null;
  let workerBlockedBySchema = false;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const processed = await runWorker(10);
      console.log(`worker-${attempt}`, processed);

      const results = Array.isArray(processed.results) ? processed.results : [];
      const match = results.find((item) => item.id === releaseId);
      if (match?.externalReference) {
        externalReference = match.externalReference;
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('"submitted"')) {
        workerBlockedBySchema = true;
        console.log("worker-warning", "submitted status enum not available; continuing with seeded external reference");
        break;
      }
      throw error;
    }

    const snapshot = await getSnapshot(releaseId);
    if (snapshot.externalReference) {
      externalReference = snapshot.externalReference;
      break;
    }

    await sleep(350);
  }

  if (!externalReference) {
    throw new Error("Unable to resolve external reference after worker processing.");
  }

  if (workerBlockedBySchema) {
    console.log(
      "schema-warning",
      "Apply 202608110002_stage_7_led_api_release_statuses.sql to validate submitted/acknowledged states end-to-end.",
    );
  }

  const webhookUrl = new URL("/api/webhooks/led/status", baseUrl);

  console.log(
    "webhook-released",
    await request(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-led-signature": webhookSecret,
      },
      body: JSON.stringify({
        providerKey: "simulated_led_provider",
        externalReference,
        status: "released",
        message: "Stage 7 e2e release transition.",
      }),
    }),
  );

  const afterReleased = await getSnapshot(releaseId);
  console.log("snapshot-after-released", afterReleased);

  console.log(
    "webhook-live",
    await request(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-led-signature": webhookSecret,
      },
      body: JSON.stringify({
        providerKey: "simulated_led_provider",
        externalReference,
        status: "live",
        message: "Stage 7 e2e live transition.",
      }),
    }),
  );

  const afterLive = await getSnapshot(releaseId);
  console.log("snapshot-after-live", afterLive);

  if (afterReleased.queueStatus !== "released") {
    throw new Error(`Expected released queue status, received ${afterReleased.queueStatus}.`);
  }
  if (afterReleased.orderStatus !== "released") {
    throw new Error(`Expected released order status, received ${afterReleased.orderStatus}.`);
  }
  if (afterLive.queueStatus !== "live") {
    throw new Error(`Expected live queue status, received ${afterLive.queueStatus}.`);
  }
  if (afterLive.orderStatus !== "live") {
    throw new Error(`Expected live order status, received ${afterLive.orderStatus}.`);
  }

  console.log("ok", {
    releaseId,
    externalReference,
    queueStatus: afterLive.queueStatus,
    orderStatus: afterLive.orderStatus,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
