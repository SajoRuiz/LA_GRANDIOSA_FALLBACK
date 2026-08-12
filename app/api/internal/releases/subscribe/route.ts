import { NextRequest, NextResponse } from "next/server";

import { automationRequestIsAuthorized } from "@/lib/server/cron-auth";
import { getCommerceServerConfig } from "@/lib/server/config";
import { subscribeLedSolutionChangeNotifications } from "@/lib/server/led-release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeCallbackUrl(
  input: unknown,
  fallback: string,
): string {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return fallback;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const prefixed = raw.startsWith("/") ? raw : `/${raw}`;
  return new URL(prefixed, fallback).toString();
}

async function run(request: NextRequest) {
  if (!(await automationRequestIsAuthorized(request))) {
    return NextResponse.json(
      { error: "Release-worker authorization required." },
      { status: 401 },
    );
  }

  try {
    const config = getCommerceServerConfig();
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const fallbackCallback = new URL(
      `/api/webhooks/led/status?token=${encodeURIComponent(
        config.ledProviderWebhookSecret,
      )}`,
      config.appBaseUrl,
    ).toString();

    const callbackUrl = normalizeCallbackUrl(
      body.callbackUrl,
      fallbackCallback,
    );

    const result = await subscribeLedSolutionChangeNotifications(
      callbackUrl,
    );

    return NextResponse.json({ ok: true, callbackUrl, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "LED subscription registration failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return run(request);
}

export async function GET(request: NextRequest) {
  return run(request);
}
