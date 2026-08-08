import { NextRequest, NextResponse } from "next/server";
import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_TYPES = new Set([
  "opening_balance",
  "invoice",
  "payment",
  "credit_memo",
  "debit_adjustment",
  "credit_adjustment",
  "write_off",
]);

export async function POST(
  request: NextRequest,
  context: { params: { agencyId: string } },
) {
  try {
    const staff = await requireStaffAccessForApi([
      "finance",
      "system_admin",
    ]);
    const { agencyId } = context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const entryType = String(body.entryType ?? "");
    const amountDollars = Number(body.amountDollars ?? 0);
    const reference = String(body.reference ?? "").trim();
    const note = String(body.note ?? "").trim();

    if (!VALID_TYPES.has(entryType)) {
      throw new Error("Credit ledger entry type is invalid.");
    }

    if (!Number.isFinite(amountDollars) || amountDollars === 0) {
      throw new Error("Enter a non-zero signed dollar amount.");
    }

    const absoluteAmountCents = Math.round(Math.abs(amountDollars) * 100);
    const reducingTypes = new Set([
      "payment",
      "credit_memo",
      "credit_adjustment",
      "write_off",
    ]);
    const amountCents = reducingTypes.has(entryType)
      ? -absoluteAmountCents
      : absoluteAmountCents;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc(
      "record_agency_credit_ledger_entry",
      {
        p_agency_id: agencyId,
        p_entry_type: entryType,
        p_amount_cents: amountCents,
        p_reference: reference,
        p_note: note,
        p_actor_user_id: staff.identity.userId,
      },
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, entryId: data });
  } catch (error) {
    if (error instanceof AgencyAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Credit ledger entry could not be recorded.",
      },
      { status: 400 },
    );
  }
}
