import {
  addUtcDays,
  countInclusiveCalendarDays,
  formatUtcDateToIso,
  parseIsoDateToUtc,
  summarizeServiceSchedule,
  type ServiceScheduleSummary,
} from "./service-calendar";

export const BILLING_MONTH_DAYS = 31;
export const ROLLING_MONTH_DAYS = 30;
export const MONTH_GRACE_DAYS = 1;
export const DATE_SELECTION_PREMIUM_PERCENT = 10;
export const MULTI_MONTH_DISCOUNT_PERCENT = 10;

export type PricingBasis =
  | "daily-prorated"
  | "monthly-buy"
  | "multi-month-buy"
  | "mixed-month-partial";

export interface CampaignPriceBreakdown extends ServiceScheduleSummary {
  monthlyRateCents: number;
  pricingBasis: PricingBasis;

  /**
   * Number of full monthly billing units.
   *
   * Examples:
   * 30-31 days = 1
   * 60-61 days = 2
   * 90-91 days = 3
   *
   * A selection that is exactly one or more complete calendar months also
   * uses the actual calendar-month count, including February.
   */
  fullMonthUnits: number;

  /** Calendar days assigned to full monthly billing units. */
  monthlyCoverageDays: number;

  /** Calendar days remaining after the monthly portion. */
  partialCalendarDays: number;

  /** Operating days inside the partial remainder. */
  partialBillableDays: number;

  /** Total operating days across the complete selected range. */
  billableDays: number;

  /** Monthly units plus partial-day gross subtotal before holiday deductions. */
  grossMediaSubtotalCents: number;

  /** Holiday deductions across both monthly and partial portions. */
  closedHolidayDeductionCents: number;

  /** Media subtotal after holiday deductions and before premium/discount. */
  mediaSubtotalCents: number;

  /** 10% premium applied only to the adjusted partial remainder. */
  dateSelectionPremiumCents: number;

  /**
   * 10% discount applied only when the entire range is an exact purchase of
   * two or more monthly units, with no partial remainder.
   */
  multiMonthDiscountCents: number;

  totalCents: number;
}

interface BillingStructure {
  completeCalendarMonths: number;
  fullMonthUnits: number;
  monthlyCoverageDays: number;
  partialCalendarDays: number;
  exactMonthMultiplier: boolean;
}

function lastDayOfUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Count complete calendar months only when the entire selection begins on the
 * first day of a month and ends on the final day of a month.
 *
 * This preserves February as a full monthly purchase even when it has 28 or
 * 29 calendar days.
 */
export function countCompleteCalendarMonths(
  startDate: string,
  endDate: string,
): number {
  const start = parseIsoDateToUtc(startDate);
  const end = parseIsoDateToUtc(endDate);

  if (end.getTime() < start.getTime()) {
    throw new Error("The end date must be on or after the start date.");
  }

  if (start.getUTCDate() !== 1) {
    return 0;
  }

  if (
    end.getUTCDate() !==
    lastDayOfUtcMonth(end.getUTCFullYear(), end.getUTCMonth())
  ) {
    return 0;
  }

  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}

/**
 * Determine how an arbitrary range is divided between full monthly billing
 * units and a remaining partial period.
 *
 * Rules:
 * - Any complete calendar month range uses the actual month count.
 * - Otherwise, every 30-day block is one monthly unit.
 * - One additional grace day may be absorbed by the monthly portion:
 *   30-31 = 1 month, 60-61 = 2 months, 90-91 = 3 months, etc.
 * - Any days beyond that become a partial remainder.
 */
export function getBillingStructure(
  startDate: string,
  endDate: string,
): BillingStructure {
  const calendarDays = countInclusiveCalendarDays(startDate, endDate);
  const completeCalendarMonths = countCompleteCalendarMonths(
    startDate,
    endDate,
  );

  if (completeCalendarMonths >= 1) {
    return {
      completeCalendarMonths,
      fullMonthUnits: completeCalendarMonths,
      monthlyCoverageDays: calendarDays,
      partialCalendarDays: 0,
      exactMonthMultiplier: true,
    };
  }

  const fullMonthUnits = Math.floor(calendarDays / ROLLING_MONTH_DAYS);

  if (fullMonthUnits === 0) {
    return {
      completeCalendarMonths: 0,
      fullMonthUnits: 0,
      monthlyCoverageDays: 0,
      partialCalendarDays: calendarDays,
      exactMonthMultiplier: false,
    };
  }

  const baseMonthlyCoverageDays =
    fullMonthUnits * ROLLING_MONTH_DAYS;
  const remainingAfterBase =
    calendarDays - baseMonthlyCoverageDays;

  const graceDaysUsed =
    remainingAfterBase >= MONTH_GRACE_DAYS
      ? MONTH_GRACE_DAYS
      : 0;

  const monthlyCoverageDays =
    baseMonthlyCoverageDays + graceDaysUsed;
  const partialCalendarDays =
    calendarDays - monthlyCoverageDays;

  return {
    completeCalendarMonths: 0,
    fullMonthUnits,
    monthlyCoverageDays,
    partialCalendarDays,
    exactMonthMultiplier: partialCalendarDays === 0,
  };
}

function scheduleForFirstDays(
  startDate: string,
  numberOfDays: number,
): ServiceScheduleSummary | undefined {
  if (numberOfDays <= 0) {
    return undefined;
  }

  const start = parseIsoDateToUtc(startDate);
  const end = addUtcDays(start, numberOfDays - 1);

  return summarizeServiceSchedule(
    startDate,
    formatUtcDateToIso(end),
  );
}

function scheduleForRemainingDays(
  startDate: string,
  monthlyCoverageDays: number,
  partialCalendarDays: number,
): ServiceScheduleSummary | undefined {
  if (partialCalendarDays <= 0) {
    return undefined;
  }

  const start = addUtcDays(
    parseIsoDateToUtc(startDate),
    monthlyCoverageDays,
  );
  const end = addUtcDays(start, partialCalendarDays - 1);

  return summarizeServiceSchedule(
    formatUtcDateToIso(start),
    formatUtcDateToIso(end),
  );
}

function calculateDailyEquivalent(
  monthlyRateCents: number,
  days: number,
): number {
  return Math.round(
    (monthlyRateCents * days) / BILLING_MONTH_DAYS,
  );
}

export function getCampaignRangeError(
  startDate: string,
  endDate: string,
): string | undefined {
  try {
    const schedule = summarizeServiceSchedule(startDate, endDate);

    if (schedule.operatingDays === 0) {
      return "The selected range contains no operating days.";
    }

    return undefined;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "The selected date range is invalid.";
  }
}

export function pricingBasisLabel(
  pricing: Pick<
    CampaignPriceBreakdown,
    | "pricingBasis"
    | "fullMonthUnits"
    | "partialCalendarDays"
  >,
): string {
  if (pricing.pricingBasis === "multi-month-buy") {
    return `${pricing.fullMonthUnits}-month buy`;
  }

  if (pricing.pricingBasis === "monthly-buy") {
    return "Monthly buy";
  }

  if (pricing.pricingBasis === "mixed-month-partial") {
    const monthLabel =
      pricing.fullMonthUnits === 1 ? "month" : "months";

    return (
      `${pricing.fullMonthUnits} ${monthLabel} + ` +
      `${pricing.partialCalendarDays}-day partial`
    );
  }

  return "Daily proration";
}

export function calculateCampaignPrice(
  monthlyRateCents: number,
  startDate: string,
  endDate: string,
): CampaignPriceBreakdown {
  if (!Number.isInteger(monthlyRateCents) || monthlyRateCents < 0) {
    throw new Error(
      "The monthly rate must be a non-negative integer in cents.",
    );
  }

  const rangeError = getCampaignRangeError(startDate, endDate);

  if (rangeError) {
    throw new Error(rangeError);
  }

  const completeSchedule = summarizeServiceSchedule(
    startDate,
    endDate,
  );
  const structure = getBillingStructure(startDate, endDate);

  const monthlySchedule = scheduleForFirstDays(
    startDate,
    structure.monthlyCoverageDays,
  );
  const partialSchedule = scheduleForRemainingDays(
    startDate,
    structure.monthlyCoverageDays,
    structure.partialCalendarDays,
  );

  const monthlyGrossCents =
    monthlyRateCents * structure.fullMonthUnits;

  const partialGrossCents = calculateDailyEquivalent(
    monthlyRateCents,
    structure.partialCalendarDays,
  );

  const monthlyHolidayDeductionCents =
    calculateDailyEquivalent(
      monthlyRateCents,
      monthlySchedule?.closedDays ?? 0,
    );

  const partialHolidayDeductionCents =
    calculateDailyEquivalent(
      monthlyRateCents,
      partialSchedule?.closedDays ?? 0,
    );

  const closedHolidayDeductionCents =
    monthlyHolidayDeductionCents +
    partialHolidayDeductionCents;

  const adjustedMonthlyCents = Math.max(
    0,
    monthlyGrossCents - monthlyHolidayDeductionCents,
  );

  const adjustedPartialCents = Math.max(
    0,
    partialGrossCents - partialHolidayDeductionCents,
  );

  const grossMediaSubtotalCents =
    monthlyGrossCents + partialGrossCents;

  const mediaSubtotalCents =
    adjustedMonthlyCents + adjustedPartialCents;

  /**
   * The 10% exact-date premium applies only to the adjusted partial remainder.
   * Monthly units never receive this premium. Holiday deductions do not
   * activate or increase the premium.
   */
  const dateSelectionPremiumCents =
    structure.partialCalendarDays > 0
      ? Math.round(
          (adjustedPartialCents *
            DATE_SELECTION_PREMIUM_PERCENT) /
            100,
        )
      : 0;

  /**
   * The 10% multi-month discount applies only when the complete selection is
   * an exact purchase of two or more monthly units, with no partial remainder.
   * Holiday deductions happen first.
   */
  const multiMonthDiscountCents =
    structure.exactMonthMultiplier &&
    structure.fullMonthUnits >= 2
      ? Math.round(
          (mediaSubtotalCents *
            MULTI_MONTH_DISCOUNT_PERCENT) /
            100,
        )
      : 0;

  let pricingBasis: PricingBasis;

  if (
    structure.exactMonthMultiplier &&
    structure.fullMonthUnits >= 2
  ) {
    pricingBasis = "multi-month-buy";
  } else if (
    structure.exactMonthMultiplier &&
    structure.fullMonthUnits === 1
  ) {
    pricingBasis = "monthly-buy";
  } else if (structure.fullMonthUnits >= 1) {
    pricingBasis = "mixed-month-partial";
  } else {
    pricingBasis = "daily-prorated";
  }

  return {
    ...completeSchedule,
    monthlyRateCents,
    pricingBasis,
    fullMonthUnits: structure.fullMonthUnits,
    monthlyCoverageDays: structure.monthlyCoverageDays,
    partialCalendarDays: structure.partialCalendarDays,
    partialBillableDays:
      partialSchedule?.operatingDays ?? 0,
    billableDays: completeSchedule.operatingDays,
    grossMediaSubtotalCents,
    closedHolidayDeductionCents,
    mediaSubtotalCents,
    dateSelectionPremiumCents,
    multiMonthDiscountCents,
    totalCents:
      mediaSubtotalCents +
      dateSelectionPremiumCents -
      multiMonthDiscountCents,
  };
}

// Backward-compatible aliases for earlier prototype imports.
export const countInclusiveDays = countInclusiveCalendarDays;
export const calculateProratedPrice = calculateCampaignPrice;
export type ProratedPriceBreakdown = CampaignPriceBreakdown;
