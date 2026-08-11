import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getCommerceServerConfig } from "@/lib/server/config";
import { applyLedWebhookStatus } from "@/lib/server/led-release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signatureIsValid(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const config = getCommerceServerConfig();
    if (!config.ledProviderWebhookSecret) {
      return NextResponse.json(
        { error: "LED webhook secret is not configured." },
        { status: 503 },
      );
    }

    const provided =
      request.headers.get("x-led-signature")?.trim() ?? "";
    if (!provided) {
      return NextResponse.json(
        { error: "LED webhook signature is required." },
        { status: 401 },
      );
    }

    if (!signatureIsValid(provided, config.ledProviderWebhookSecret)) {
      return NextResponse.json(
        { error: "LED webhook signature is invalid." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const externalReference = String(
      body.externalReference ?? body.external_reference ?? "",
    ).trim();
    const status = String(body.status ?? "").trim();

    if (!externalReference || !status) {
      return NextResponse.json(
        {
          error:
            "Webhook payload requires externalReference and status.",
        },
        { status: 400 },
      );
    }

    const message = String(body.message ?? "").trim() || undefined;
    const providerKey =
      String(body.providerKey ?? "").trim() || "led_provider_api";

    const result = await applyLedWebhookStatus({
      externalReference,
      status,
      providerKey,
      message,
      raw: body,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (
      error instanceof Error &&
      /Release queue row was not found/i.test(error.message)
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "LED webhook handling failed.",
      },
      { status: 500 },
    );
  }
}
