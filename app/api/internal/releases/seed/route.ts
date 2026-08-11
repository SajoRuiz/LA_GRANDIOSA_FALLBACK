import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { automationRequestIsAuthorized } from "@/lib/server/cron-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const DEFAULT_BUCKET = "campaign-assets";

interface QueueSnapshot {
  releaseId: string;
  orderId: string;
  orderNumber: string;
  queueStatus: string;
  orderStatus: string;
  externalReference: string | null;
}

function isoDateWithOffset(days: number): string {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function resolveActorUserId(requested?: string): Promise<string> {
  const candidate = requested?.trim();
  if (candidate) {
    return candidate;
  }

  const admin = createSupabaseAdminClient();

  const { data: staffRows, error: staffError } = await admin
    .from("staff_members")
    .select("user_id")
    .eq("active", true)
    .limit(1);
  if (staffError) {
    throw new Error(staffError.message);
  }
  const staffUserId = staffRows?.[0]?.user_id;
  if (staffUserId) {
    return String(staffUserId);
  }

  const { data: memberRows, error: memberError } = await admin
    .from("agency_members")
    .select("user_id")
    .eq("status", "active")
    .limit(1);
  if (memberError) {
    throw new Error(memberError.message);
  }
  const memberUserId = memberRows?.[0]?.user_id;
  if (memberUserId) {
    return String(memberUserId);
  }

  const { data: authRows, error: authError } = await admin
    .schema("auth")
    .from("users")
    .select("id")
    .limit(1);
  if (authError) {
    throw new Error(authError.message);
  }
  const authUserId = authRows?.[0]?.id;
  if (authUserId) {
    return String(authUserId);
  }

  throw new Error(
    "No user record is available for Stage 7 seeding. Bootstrap at least one auth user and staff member first.",
  );
}

async function ensureAgencyAccount(actorUserId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: existingRows, error: existingError } = await admin
    .from("agency_accounts")
    .select("id")
    .eq("status", "active")
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingAgencyId = existingRows?.[0]?.id;
  if (existingAgencyId) {
    return String(existingAgencyId);
  }

  const now = Date.now();
  const { data: insertedRows, error: insertError } = await admin
    .from("agency_accounts")
    .insert({
      legal_name: `Stage 7 Test Agency ${now}`,
      display_name: "Stage 7 Test Agency",
      status: "active",
      created_by_user_id: actorUserId,
      po_required: false,
      approved_credit_limit_cents: 1_000_000,
      payment_terms_days: 30,
      discount_basis_points: 0,
      discount_policy: "stack",
      effective_date: isoDateWithOffset(-1),
    })
    .select("id")
    .single();

  if (insertError || !insertedRows) {
    throw new Error(insertError?.message ?? "Could not create seed agency account.");
  }

  return String(insertedRows.id);
}

async function getQueueSnapshot(releaseId: string): Promise<QueueSnapshot> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("asset_release_queue")
    .select("id,order_id,status,external_reference,orders(order_number,status)")
    .eq("id", releaseId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Release queue row was not found.");
  }

  const order = Array.isArray(data.orders) ? data.orders[0] : data.orders;

  return {
    releaseId: String(data.id),
    orderId: String(data.order_id),
    orderNumber: String(order?.order_number ?? ""),
    queueStatus: String(data.status),
    orderStatus: String(order?.status ?? ""),
    externalReference: data.external_reference
      ? String(data.external_reference)
      : null,
  };
}

export async function GET(request: NextRequest) {
  if (!(await automationRequestIsAuthorized(request))) {
    return NextResponse.json(
      { error: "Release seed authorization required." },
      { status: 401 },
    );
  }

  const releaseId = request.nextUrl.searchParams.get("releaseId")?.trim();
  if (!releaseId) {
    return NextResponse.json(
      { error: "releaseId query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const snapshot = await getQueueSnapshot(releaseId);
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not fetch seeded release status.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await automationRequestIsAuthorized(request))) {
    return NextResponse.json(
      { error: "Release seed authorization required." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const actorUserId = await resolveActorUserId(
      typeof body.actorUserId === "string" ? body.actorUserId : undefined,
    );
    const agencyId = await ensureAgencyAccount(actorUserId);
    const admin = createSupabaseAdminClient();

    const seedKey = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const startDate =
      typeof body.startDate === "string" && body.startDate.trim()
        ? body.startDate.trim()
        : isoDateWithOffset(1);
    const endDate =
      typeof body.endDate === "string" && body.endDate.trim()
        ? body.endDate.trim()
        : isoDateWithOffset(8);

    const { data: contactRow, error: contactError } = await admin
      .from("client_contacts")
      .insert({
        full_name: "Stage 7 Queue Tester",
        email: `stage7+${seedKey}@example.test`,
        telephone: "+17870000000",
        address_line_1: "500 Commerce Ave",
        city: "San Juan",
        region: "PR",
        postal_code: "00907",
        country: "PR",
        company_name: "La Grandiosa QA",
        campaign_name: `Stage 7 Seed ${seedKey}`,
        agency_id: agencyId,
      })
      .select("id")
      .single();

    if (contactError || !contactRow) {
      throw new Error(contactError?.message ?? "Could not create seed client contact.");
    }

    const orderNumber = `LG-S7-${Date.now()}`;
    const { data: orderRow, error: orderError } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        client_contact_id: String(contactRow.id),
        status: "release_pending",
        client_snapshot: {
          fullName: "Stage 7 Queue Tester",
          email: `stage7+${seedKey}@example.test`,
        },
        pricing_snapshot: {
          source: "stage-7-internal-seed",
          currency: "USD",
        },
        source: "internal_stage7_seed",
        agency_id: agencyId,
        ordered_by_user_id: actorUserId,
      })
      .select("id")
      .single();

    if (orderError || !orderRow) {
      throw new Error(orderError?.message ?? "Could not create seed order.");
    }

    const { data: orderItemRow, error: itemError } = await admin
      .from("order_items")
      .insert({
        order_id: String(orderRow.id),
        cart_item_id: `seed-${seedKey}`,
        sort_order: 0,
        sku: "LG-SEED-LED-001",
        start_date: startDate,
        end_date: endDate,
        combination_snapshot: {
          screenPackage: "center",
          durationWeeks: 1,
        },
        pricing_snapshot: {
          grossMediaSubtotalCents: 25000,
          totalCents: 25000,
        },
        total_cents: 25000,
      })
      .select("id")
      .single();

    if (itemError || !orderItemRow) {
      throw new Error(itemError?.message ?? "Could not create seed order item.");
    }

    const { data: slotRow, error: slotError } = await admin
      .from("order_asset_slots")
      .insert({
        order_id: String(orderRow.id),
        order_item_id: String(orderItemRow.id),
        slot_key: `seed-center-${seedKey}`,
        screen_target: "center",
        format: "silent-video",
        duration_seconds: 15,
        required: true,
        status: "approved",
        specification_snapshot: {
          source: "stage-7-seed",
          mimeTypes: ["video/mp4"],
        },
      })
      .select("id")
      .single();

    if (slotError || !slotRow) {
      throw new Error(slotError?.message ?? "Could not create seed asset slot.");
    }

    const storagePath = `stage7-seed/${seedKey}.mp4`;
    const fileBody = new Blob([`stage-7-seed-${seedKey}`], {
      type: "video/mp4",
    });

    const upload = await admin.storage
      .from(DEFAULT_BUCKET)
      .upload(storagePath, fileBody, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (upload.error) {
      throw new Error(upload.error.message);
    }

    const { data: fileRow, error: fileError } = await admin
      .from("asset_files")
      .insert({
        asset_slot_id: String(slotRow.id),
        version_number: 1,
        status: "approved",
        storage_bucket: DEFAULT_BUCKET,
        storage_path: storagePath,
        original_filename: `seed-${seedKey}.mp4`,
        mime_type: "video/mp4",
        file_size_bytes: fileBody.size,
        uploaded_by_user_id: actorUserId,
      })
      .select("id")
      .single();

    if (fileError || !fileRow) {
      throw new Error(fileError?.message ?? "Could not create seed asset file.");
    }

    const { error: slotUpdateError } = await admin
      .from("order_asset_slots")
      .update({ current_asset_file_id: String(fileRow.id), status: "approved" })
      .eq("id", String(slotRow.id));

    if (slotUpdateError) {
      throw new Error(slotUpdateError.message);
    }

    const { data: submissionRow, error: submissionError } = await admin
      .from("asset_submissions")
      .insert({
        order_id: String(orderRow.id),
        submission_number: 1,
        status: "approved",
        submitted_by_user_id: actorUserId,
        reviewer_user_id: actorUserId,
        review_note: "Stage 7 queue-linked seed approved for local testing.",
        reviewed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (submissionError || !submissionRow) {
      throw new Error(
        submissionError?.message ?? "Could not create seed asset submission.",
      );
    }

    const { error: submissionItemError } = await admin
      .from("asset_submission_items")
      .insert({
        submission_id: String(submissionRow.id),
        asset_slot_id: String(slotRow.id),
        asset_file_id: String(fileRow.id),
        status: "approved",
      });

    if (submissionItemError) {
      throw new Error(submissionItemError.message);
    }

    const { data: releaseRow, error: releaseError } = await admin
      .from("asset_release_queue")
      .insert({
        order_id: String(orderRow.id),
        asset_submission_id: String(submissionRow.id),
        provider_key: "led_provider_api",
        status: "pending",
        external_reference: `seed-${seedKey}`,
        request_payload: {
          source: "internal_stage7_seed",
          seedKey,
        },
      })
      .select("id")
      .single();

    if (releaseError || !releaseRow) {
      throw new Error(releaseError?.message ?? "Could not create release queue row.");
    }

    const snapshot = await getQueueSnapshot(String(releaseRow.id));

    return NextResponse.json({
      ok: true,
      seeded: {
        actorUserId,
        agencyId,
        seedKey,
      },
      ...snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stage 7 seed generation failed.",
      },
      { status: 400 },
    );
  }
}
