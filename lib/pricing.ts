import {
  countInclusiveCalendarDays,
  formatUtcDateToIso,
  parseIsoDateToUtc,
  summarizeServiceSchedule,
  type ServiceScheduleSummary,
} from "./service-calendar";

export const BILLING_MONTH_DAYS = 31;
export const MONTHLY_BUY_MIN_DAYS = 30;
export const DATE_SELECTION_PREMIUM_PERCENT = 10;
export const MULTI_MONTH_DISCOUNT_PERCENT = 10;

/**
 * For 1–29 day campaigns, closed holidays are excluded from billable days.
 * For monthly and complete multi-month buys, each closed holiday creates a
 * daily-rate subtraction from the monthly price. No 10% date-selection
 * premium is added to that subtraction.
 */
export const EXCLUDE_CLOSED_DAYS_FROM_PARTIAL_PRORATION = true;

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

function calculateClosedHolidayDeduction(
  monthlyRateCents: number,
  closedDays: number,
): number {
  return Math.round((monthlyRateCents * closedDays) / BILLING_MONTH_DAYS);
}

/**
 * For complete multi-month selections, calculate each month's holiday
 * subtraction separately and then add the monthly deductions together.
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

  // Two or more complete calendar months:
  // 1. Gross monthly total.
  // 2. Subtract closed-holiday daily amounts for each month.
  // 3. Apply the 10% multi-month discount to the adjusted subtotal.
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

  // A complete calendar month, including February, or any rolling 30–31 day
  // selection counts as one monthly buy. Each closed holiday subtracts one
  // 31-day daily-rate amount. No 10% date-selection premium applies.
  if (
    completeMonths === 1 ||
    schedule.calendarDays === 30 ||
    schedule.calendarDays === 31
  ) {
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

  // 1–29 days:
  // Daily proration uses operating days, excluding closed holidays. The 10%
  // exact-date premium applies only to the resulting operating-day subtotal.
  const billableDays = EXCLUDE_CLOSED_DAYS_FROM_PARTIAL_PRORATION
    ? schedule.operatingDays
    : schedule.calendarDays;

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
