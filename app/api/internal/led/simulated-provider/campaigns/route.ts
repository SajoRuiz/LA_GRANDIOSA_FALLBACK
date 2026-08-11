import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import type { LedCampaignRelease } from "@/lib/led/types";
import { getCommerceServerConfig } from "@/lib/server/config";
import { createSimulatorRecord } from "@/lib/server/led-simulator-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestIsAuthorized(request: NextRequest): boolean {
  const config = getCommerceServerConfig();
  const authorization = request.headers.get("authorization") ?? "";

  return Boolean(
    config.ledProviderApiKey &&
      authorization === `Bearer ${config.ledProviderApiKey}`,
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!requestIsAuthorized(request)) {
      return NextResponse.json(
        { error: "Simulated LED provider authorization required." },
        { status: 401 },
      );
    }

    const release = (await request.json()) as LedCampaignRelease;
    if (!release?.releaseId || !release?.orderId || !release?.orderNumber) {
      return NextResponse.json(
        { error: "Release payload is incomplete." },
        { status: 400 },
      );
    }

    const externalReference = `sim-${release.releaseId}-${randomUUID().slice(0, 8)}`;
    const payload = {
      acceptedAt: new Date().toISOString(),
      assetCount: Array.isArray(release.assets) ? release.assets.length : 0,
      receivedReleaseId: release.releaseId,
      orderNumber: release.orderNumber,
    };

    await createSimulatorRecord({
      external_reference: externalReference,
      release_id: release.releaseId,
      order_id: release.orderId,
      provider_key: "simulated_led_provider",
      status: "submitted",
      request_payload: release as unknown as Record<string, unknown>,
      status_payload: payload,
      message: "Simulated provider accepted the campaign.",
    });

    return NextResponse.json({
      providerKey: "simulated_led_provider",
      externalReference,
      status: "submitted",
      raw: payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Simulated provider submit failed.",
      },
      { status: 400 },
    );
  }
}