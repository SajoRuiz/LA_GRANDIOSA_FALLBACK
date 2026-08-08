export type DiscountPolicy =
  | "stack"
  | "best_of"
  | "agency_replaces_campaign";

export interface CampaignPricingTotals {
  /** Adjusted media subtotal plus date-selection premiums, before discounts. */
  preDiscountTotalCents: number;
  /** Campaign discount offered by the public campaign rules. */
  campaignDiscountAvailableCents: number;
}

export interface AgencyPricingTerms {
  discountBasisPoints: number;
  discountPolicy: DiscountPolicy;
}

export interface AgencyPricingBreakdown {
  preDiscountTotalCents: number;
  campaignDiscountAvailableCents: number;
  campaignDiscountAppliedCents: number;
  /** Public rate after the standard campaign discount, before agency terms. */
  publicPublishedTotalCents: number;
  /** Pricing base after the account's discount-policy decision. */
  agencyDiscountBaseCents: number;
  agencyDiscountBasisPoints: number;
  agencyDiscountCandidateCents: number;
  agencyDiscountCents: number;
  netContractTotalCents: number;
  discountPolicy: DiscountPolicy;
}

export interface AgencyCreditSummary {
  agencyId: string;
  approvedCreditLimitCents: number;
  ledgerExposureCents: number;
  activeHoldExposureCents: number;
  pendingExceptionCents: number;
  currentExposureCents: number;
  availableCreditCents: number;
}

export interface CreditProjection {
  status: "within_limit" | "review_required";
  requestedCreditCents: number;
  availableCreditBeforeCents: number;
  availableCreditAfterCents: number;
  shortfallCents: number;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  return Math.round(value);
}

export function discountPolicyLabel(policy: DiscountPolicy): string {
  if (policy === "stack") {
    return "Stack with campaign pricing";
  }

  if (policy === "best_of") {
    return "Use the best discount";
  }

  return "Agency discount replaces campaign discount";
}

export function calculateAgencyPricing(
  campaign: CampaignPricingTotals,
  terms: AgencyPricingTerms,
): AgencyPricingBreakdown {
  const preDiscountTotalCents = nonNegativeInteger(
    campaign.preDiscountTotalCents,
    "Pre-discount total",
  );
  const campaignDiscountAvailableCents = Math.min(
    nonNegativeInteger(
      campaign.campaignDiscountAvailableCents,
      "Campaign discount",
    ),
    preDiscountTotalCents,
  );
  const agencyDiscountBasisPoints = Math.min(
    nonNegativeInteger(
      terms.discountBasisPoints,
      "Agency discount basis points",
    ),
    10_000,
  );

  const publicPublishedTotalCents = Math.max(
    0,
    preDiscountTotalCents - campaignDiscountAvailableCents,
  );
  const agencyDiscountOnPreDiscountCents = Math.round(
    (preDiscountTotalCents * agencyDiscountBasisPoints) / 10_000,
  );

  let campaignDiscountAppliedCents = campaignDiscountAvailableCents;
  let agencyDiscountBaseCents = publicPublishedTotalCents;
  let agencyDiscountCents = 0;

  if (terms.discountPolicy === "stack") {
    agencyDiscountCents = Math.round(
      (publicPublishedTotalCents * agencyDiscountBasisPoints) / 10_000,
    );
  } else if (terms.discountPolicy === "best_of") {
    if (
      agencyDiscountOnPreDiscountCents > campaignDiscountAvailableCents
    ) {
      campaignDiscountAppliedCents = 0;
      agencyDiscountBaseCents = preDiscountTotalCents;
      agencyDiscountCents = agencyDiscountOnPreDiscountCents;
    }
  } else {
    campaignDiscountAppliedCents = 0;
    agencyDiscountBaseCents = preDiscountTotalCents;
    agencyDiscountCents = agencyDiscountOnPreDiscountCents;
  }

  return {
    preDiscountTotalCents,
    campaignDiscountAvailableCents,
    campaignDiscountAppliedCents,
    publicPublishedTotalCents,
    agencyDiscountBaseCents,
    agencyDiscountBasisPoints,
    agencyDiscountCandidateCents: agencyDiscountOnPreDiscountCents,
    agencyDiscountCents,
    netContractTotalCents: Math.max(
      0,
      agencyDiscountBaseCents - agencyDiscountCents,
    ),
    discountPolicy: terms.discountPolicy,
  };
}

export function projectAgencyCredit(
  availableCreditCents: number,
  requestedCreditCents: number,
): CreditProjection {
  const available = nonNegativeInteger(
    availableCreditCents,
    "Available credit",
  );
  const requested = nonNegativeInteger(
    requestedCreditCents,
    "Requested credit",
  );

  if (requested <= available) {
    return {
      status: "within_limit",
      requestedCreditCents: requested,
      availableCreditBeforeCents: available,
      availableCreditAfterCents: available - requested,
      shortfallCents: 0,
    };
  }

  return {
    status: "review_required",
    requestedCreditCents: requested,
    availableCreditBeforeCents: available,
    availableCreditAfterCents: available,
    shortfallCents: requested - available,
  };
}
