import { NextRequest, NextResponse } from "next/server";
import {
  AgencyAccessError,
  requireStaffAccessForApi,
} from "@/lib/auth/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface AgencyAccountRow {
  id: string;
  account_number: string;
  display_name: string;
}

const MIN_DISCOUNT_BASIS_POINTS = 0;
const MAX_DISCOUNT_BASIS_POINTS = 10000;

export async function POST(request: NextRequest) {
  try {
    await requireStaffAccessForApi(["finance", "system_admin"]);

    const body = (await request.json()) as Record<string, unknown>;
    const legalName = typeof body.legalName === "string" ? body.legalName.trim() : "";
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const discountBasisPoints = Number(body.discountBasisPoints ?? 0);
    const approvedCreditLimitCents = Math.round(Number(body.approvedCreditLimitCents ?? 0));
    const paymentTermsDays = Number(body.paymentTermsDays ?? 30);
    const discountPolicy =
      body.discountPolicy === "best_of" ||
      body.discountPolicy === "agency_replaces_campaign"
        ? body.discountPolicy
        : "stack";
    const poRequired = body.poRequired === true;
    const authorizedEmailDomains = Array.isArray(body.authorizedEmailDomains)
      ? body.authorizedEmailDomains
          .map((value) => String(value).trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (!legalName) {
      throw new Error("Agency legal name is required.");
    }

    if (!displayName) {
      throw new Error("Agency display name is required.");
    }

    if (
      !Number.isInteger(discountBasisPoints) ||
      discountBasisPoints < MIN_DISCOUNT_BASIS_POINTS ||
      discountBasisPoints > MAX_DISCOUNT_BASIS_POINTS
    ) {
      throw new Error(
        "Discount basis points must be an integer between 0 and 10000.",
      );
    }

    if (approvedCreditLimitCents < 0) {
      throw new Error("Approved credit limit must be zero or greater.");
    }

    if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0) {
      throw new Error("Payment terms must be a non-negative whole number of days.");
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("agency_accounts").insert({
      legal_name: legalName,
      display_name: displayName,
      discount_basis_points: discountBasisPoints,
      approved_credit_limit_cents: approvedCreditLimitCents,
      payment_terms_days: paymentTermsDays,
      discount_policy: discountPolicy,
      po_required: poRequired,
      authorized_email_domains: authorizedEmailDomains,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    const created = Array.isArray(data)
      ? (data[0] as AgencyAccountRow | null)
      : (data as AgencyAccountRow | null);

    return NextResponse.json(
      {
        agency: {
          id: String(created?.id ?? ""),
          account_number: String(created?.account_number ?? ""),
          display_name: String(created?.display_name ?? ""),
        },
      },
      { status: 201 },
    );
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
            : "The agency account could not be created.",
      },
      { status: 400 },
    );
  }
}
