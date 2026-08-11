import { NextRequest, NextResponse } from "next/server";

import { getCommerceServerConfig } from "@/lib/server/config";
import type { LedSimulatorRecord } from "@/lib/server/led-simulator-store";
import { updateSimulatorRecord } from "@/lib/server/led-simulator-store";

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

export async function POST(
  request: NextRequest,
  context: { params: { externalReference: string } },
) {
  try {
    if (!requestIsAuthorized(request)) {
      return NextResponse.json(
        { error: "Simulated LED provider authorization required." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const status = String(body.status ?? "").trim().toLowerCase();
    const message = String(body.message ?? "").trim();

    if (
      ![
        "pending",
        "processing",
        "submitted",
        "acknowledged",
        "released",
        "live",
        "failed",
        "cancelled",
      ].includes(status)
    ) {
      return NextResponse.json(
        { error: "Simulated status is invalid." },
        { status: 400 },
      );
    }

    const nextStatus = status as LedSimulatorRecord["status"];

    const data = await updateSimulatorRecord(
      context.params.externalReference,
      {
        status: nextStatus,
        status_payload: {
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        },
        message:
          message || `Simulated provider moved campaign to ${nextStatus}.`,
      },
    );

    if (!data) {
      return NextResponse.json(
        { error: "Simulated campaign was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      providerKey: data.provider_key,
      externalReference: data.external_reference,
      status: data.status,
      message: data.message ?? undefined,
      raw: data.status_payload ?? {},
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Simulated provider status update failed.",
      },
      { status: 400 },
    );
  }
}