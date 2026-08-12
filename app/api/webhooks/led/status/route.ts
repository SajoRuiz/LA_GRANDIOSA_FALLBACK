import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getLedScreenProvider } from "@/lib/led/provider";
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

    const provided = request.headers.get("x-led-signature")?.trim() ?? "";
    const queryToken = request.nextUrl.searchParams
      .get("token")
      ?.trim() ?? "";

    const signatureValid =
      !!provided && signatureIsValid(provided, config.ledProviderWebhookSecret);
    const queryTokenValid =
      !!queryToken &&
      signatureIsValid(queryToken, config.ledProviderWebhookSecret);

    if (!signatureValid && !queryTokenValid) {
      return NextResponse.json(
        { error: "LED webhook authentication is invalid." },
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

    if (!externalReference) {
      return NextResponse.json(
        {
          error: "Webhook payload requires externalReference.",
        },
        { status: 400 },
      );
    }

    const message = String(body.message ?? "").trim() || undefined;
    const providerKey =
      String(body.providerKey ?? "").trim() || "led_provider_api";

    // NovaCloud callbacks are treated as untrusted triggers.
    // We pull signed status/log data before applying internal state changes.
    let verifiedStatus = status;
    let verifiedRaw = body;
    let verifiedMessage = message;
    const provider = getLedScreenProvider();
    if (provider.mode === "api") {
      const verified = await provider.verifyCampaignStatus({
        externalReference,
      });
      verifiedStatus = verified.status;
      verifiedRaw = {
        callback: body,
        verified: verified.raw ?? {},
      };
      verifiedMessage =
        verified.message ??
        message ??
        "Webhook trigger verified via signed provider pull.";
    }

    if (!verifiedStatus) {
      return NextResponse.json(
        { error: "Verified webhook status is missing." },
        { status: 400 },
      );
    }

    const result = await applyLedWebhookStatus({
      externalReference,
      status: verifiedStatus,
      providerKey,
      message: verifiedMessage,
      raw: verifiedRaw,
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

    if (
      error instanceof Error &&
      /Multiple release queue rows matched/i.test(error.message)
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 },
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
