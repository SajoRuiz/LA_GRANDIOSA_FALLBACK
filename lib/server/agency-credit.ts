import { createSupabaseAdminClient } from "../supabase/admin";
import type { AgencyCreditSummary } from "../agency-pricing";

interface CreditSummaryRow {
  agency_id: string;
  approved_credit_limit_cents: number | string;
  ledger_exposure_cents: number | string;
  active_hold_exposure_cents: number | string;
  pending_exception_cents: number | string;
  current_exposure_cents: number | string;
  available_credit_cents: number | string;
}

function numberValue(value: number | string | null | undefined): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export async function getAgencyCreditSummary(
  agencyId: string,
): Promise<AgencyCreditSummary> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_agency_credit_summary", {
    p_agency_id: agencyId,
  });

  if (error) {
    throw new Error(
      `Agency credit summary is unavailable: ${error.message}`,
    );
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | CreditSummaryRow
    | undefined;

  if (!row) {
    throw new Error("Agency credit summary returned no data.");
  }

  return {
    agencyId: String(row.agency_id),
    approvedCreditLimitCents: numberValue(
      row.approved_credit_limit_cents,
    ),
    ledgerExposureCents: numberValue(row.ledger_exposure_cents),
    activeHoldExposureCents: numberValue(
      row.active_hold_exposure_cents,
    ),
    pendingExceptionCents: numberValue(row.pending_exception_cents),
    currentExposureCents: numberValue(row.current_exposure_cents),
    availableCreditCents: numberValue(row.available_credit_cents),
  };
}
