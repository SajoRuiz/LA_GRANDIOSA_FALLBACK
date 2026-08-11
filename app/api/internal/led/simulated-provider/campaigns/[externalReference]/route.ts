import { NextRequest, NextResponse } from "next/server";

import { getCommerceServerConfig } from "@/lib/server/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

export async function GET(
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

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("led_provider_simulations")
      .select("provider_key,external_reference,status,status_payload,message")
      .eq("external_reference", context.params.externalReference)
      .single();

    if (error || !data) {
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
            : "Simulated provider status lookup failed.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
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

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("led_provider_simulations")
      .update({
        status: "cancelled",
        status_payload: {
          cancelledAt: new Date().toISOString(),
        },
        message: "Simulated provider cancelled the campaign.",
      })
      .eq("external_reference", context.params.externalReference)
      .select("provider_key,external_reference,status,status_payload,message")
      .single();

    if (error || !data) {
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
            : "Simulated provider cancel failed.",
      },
      { status: 400 },
    );
  }
}