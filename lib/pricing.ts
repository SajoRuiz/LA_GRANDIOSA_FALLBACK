import {
  countInclusiveCalendarDays,
  formatUtcDateToIso,
  parseIsoDateToUtc,
  summarizeServiceSchedule,
  type ServiceScheduleSummary,
} from "./service-calendar";

export const BILLING_MONTH_DAYS = 31;
export const DATE_SELECTION_PREMIUM_PERCENT = 10;
export const MULTI_MONTH_DISCOUNT_PERCENT = 10;

export type PricingBasis =
  | "daily-prorated"
  | "monthly-buy"
  | "multi-month-buy";

export interface CampaignPriceBreakdown extends ServiceScheduleSummary {
  monthlyRateCents: number;
  pricingBasis: PricingBasis;
  fullCalendarMonths: number;
  billableDays: number;
  grossMediaSubtotalCents: number;
  closedHolidayDeductionCents: number;
  mediaSubtotalCents: number;
  dateSelectionPremiumCents: number;
  multiMonthDiscountCents: number;
  totalCents: number;
}

function lastDayOfUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function monthEndIso(year: number, monthIndex: number): string {
  return formatUtcDateToIso(
    new Date(Date.UTC(year, monthIndex, lastDayOfUtcMonth(year, monthIndex))),
  );
}

function monthStartIso(year: number, monthIndex: number): string {
  return formatUtcDateToIso(new Date(Date.UTC(year, monthIndex, 1)));
}

/**
 * Returns the number of complete calendar months only when:
 * - the range begins on the first day of a month; and
 * - the range ends on the final day of a month.
 *
 * A complete February therefore qualifies as one complete calendar month,
 * even though it contains only 28 or 29 calendar days.
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
 * A range qualifies for one monthly buy before any holiday adjustment when:
 * - it is one complete calendar month, including February; or
 * - it contains exactly 30 or 31 inclusive calendar days.
 *
 * Closed holidays never change this classification. They reduce the monthly
 * price after the monthly rule has already been selected.
 */
function qualifiesForOneMonthlyBuy(
  calendarDays: number,
  completeMonths: number,
): boolean {
  return (
    completeMonths === 1 ||
    calendarDays === 30 ||
    calendarDays === 31
  );
}

function calculateClosedHolidayDeduction(
  monthlyRateCents: number,
  closedDays: number,
): number {
  return Math.round((monthlyRateCents * closedDays) / BILLING_MONTH_DAYS);
}

/**
 * For complete multi-month selections, calculate each month's closed-holiday
 * subtraction separately and add those deductions together.
 */
function calculateCompleteMonthsHolidayDeduction(
  monthlyRateCents: number,
  startDate: string,
  endDate: string,
): number {
  const start = parseIsoDateToUtc(startDate);
  const end = parseIsoDateToUtc(endDate);

  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();
  let totalDeductionCents = 0;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const monthSchedule = summarizeServiceSchedule(
      monthStartIso(year, month),
      monthEndIso(year, month),
    );

    totalDeductionCents += calculateClosedHolidayDeduction(
      monthlyRateCents,
      monthSchedule.closedDays,
    );

    month += 1;

    if (month === 12) {
      month = 0;
      year += 1;
    }
  }

  return totalDeductionCents;
}

export function getCampaignRangeError(
  startDate: string,
  endDate: string,
): string | undefined {
  try {
    const schedule = summarizeServiceSchedule(startDate, endDate);
    const completeMonths = countCompleteCalendarMonths(startDate, endDate);

    if (completeMonths >= 1) {
      return undefined;
    }

    if (schedule.calendarDays <= 31) {
      if (schedule.calendarDays <= 29 && schedule.operatingDays === 0) {
        return "The selected range contains no operating days.";
      }

      return undefined;
    }

    return (
      "Selections longer than 31 days must begin on the first day of a " +
      "calendar month and end on the last day of a later calendar month."
    );
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "The selected date range is invalid.";
  }
}

export function pricingBasisLabel(
  pricing: Pick<
    CampaignPriceBreakdown,
    "pricingBasis" | "fullCalendarMonths"
  >,
): string {
  if (pricing.pricingBasis === "multi-month-buy") {
    return `${pricing.fullCalendarMonths}-month buy`;
  }

  if (pricing.pricingBasis === "monthly-buy") {
    return "Monthly buy";
  }

  return "Daily proration";
}

export function calculateCampaignPrice(
  monthlyRateCents: number,
  startDate: string,
  endDate: string,
): CampaignPriceBreakdown {
  if (!Number.isInteger(monthlyRateCents) || monthlyRateCents < 0) {
    throw new Error("The monthly rate must be a non-negative integer in cents.");
  }

  const rangeError = getCampaignRangeError(startDate, endDate);

  if (rangeError) {
    throw new Error(rangeError);
  }

  const schedule = summarizeServiceSchedule(startDate, endDate);
  const completeMonths = countCompleteCalendarMonths(startDate, endDate);

  /**
   * TWO OR MORE COMPLETE CALENDAR MONTHS
   *
   * 1. Select multi-month pricing based on the original calendar range.
   * 2. Calculate the gross monthly total.
   * 3. Subtract closed holidays month by month.
   * 4. Do not apply the 10% exact-date premium.
   * 5. Apply the 10% multi-month discount after holiday deductions.
   */
  if (completeMonths >= 2) {
    const grossMediaSubtotalCents = monthlyRateCents * completeMonths;

    const closedHolidayDeductionCents =
      calculateCompleteMonthsHolidayDeduction(
        monthlyRateCents,
        startDate,
        endDate,
      );

    const mediaSubtotalCents = Math.max(
      0,
      grossMediaSubtotalCents - closedHolidayDeductionCents,
    );

    const multiMonthDiscountCents = Math.round(
      (mediaSubtotalCents * MULTI_MONTH_DISCOUNT_PERCENT) / 100,
    );

    return {
      ...schedule,
      monthlyRateCents,
      pricingBasis: "multi-month-buy",
      fullCalendarMonths: completeMonths,
      billableDays: schedule.operatingDays,
      grossMediaSubtotalCents,
      closedHolidayDeductionCents,
      mediaSubtotalCents,
      dateSelectionPremiumCents: 0,
      multiMonthDiscountCents,
      totalCents: mediaSubtotalCents - multiMonthDiscountCents,
    };
  }

  /**
   * ONE MONTHLY BUY
   *
   * This includes:
   * - one complete calendar month, including February; or
   * - any rolling 30- or 31-day selection.
   *
   * The monthly classification is determined BEFORE holidays are subtracted.
   * Therefore, closed holidays reduce the monthly price but never turn the
   * purchase into a partial campaign and never activate the 10% premium.
   */
  if (qualifiesForOneMonthlyBuy(schedule.calendarDays, completeMonths)) {
    const grossMediaSubtotalCents = monthlyRateCents;

    const closedHolidayDeductionCents = calculateClosedHolidayDeduction(
      monthlyRateCents,
      schedule.closedDays,
    );

    const mediaSubtotalCents = Math.max(
      0,
      grossMediaSubtotalCents - closedHolidayDeductionCents,
    );

    return {
      ...schedule,
      monthlyRateCents,
      pricingBasis: "monthly-buy",
      fullCalendarMonths: completeMonths,
      billableDays: schedule.operatingDays,
      grossMediaSubtotalCents,
      closedHolidayDeductionCents,
      mediaSubtotalCents,
      dateSelectionPremiumCents: 0,
      multiMonthDiscountCents: 0,
      totalCents: mediaSubtotalCents,
    };
  }

  /**
   * PARTIAL CAMPAIGN: 1–29 CALENDAR DAYS
   *
   * Closed holidays are excluded from billable operating days.
   * The 10% exact-date premium applies to the resulting partial subtotal.
   */
  const billableDays = schedule.operatingDays;

  const grossMediaSubtotalCents = Math.round(
    (monthlyRateCents * billableDays) / BILLING_MONTH_DAYS,
  );

  const dateSelectionPremiumCents = Math.round(
    (grossMediaSubtotalCents * DATE_SELECTION_PREMIUM_PERCENT) / 100,
  );

  return {
    ...schedule,
    monthlyRateCents,
    pricingBasis: "daily-prorated",
    fullCalendarMonths: 0,
    billableDays,
    grossMediaSubtotalCents,
    closedHolidayDeductionCents: 0,
    mediaSubtotalCents: grossMediaSubtotalCents,
    dateSelectionPremiumCents,
    multiMonthDiscountCents: 0,
    totalCents: grossMediaSubtotalCents + dateSelectionPremiumCents,
  };
}

// Backward-compatible aliases for earlier prototype imports.
export const countInclusiveDays = countInclusiveCalendarDays;
export const calculateProratedPrice = calculateCampaignPrice;
export type ProratedPriceBreakdown = CampaignPriceBreakdown;
