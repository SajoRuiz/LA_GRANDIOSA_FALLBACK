export const BILLING_MONTH_DAYS = 31;
export const DATE_SELECTION_PREMIUM_PERCENT = 10;

export interface ProratedPriceBreakdown {
  inclusiveDays: number;
  monthlyRateCents: number;
  proratedBaseCents: number;
  dateSelectionPremiumCents: number;
  totalCents: number;
}

function parseIsoDateToUtc(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

export function countInclusiveDays(
  startDate: string,
  endDate: string,
): number {
  const startUtc = parseIsoDateToUtc(startDate);
  const endUtc = parseIsoDateToUtc(endDate);

  if (endUtc < startUtc) {
    throw new Error("The end date must be on or after the start date.");
  }

  return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

export function calculateProratedPrice(
  monthlyRateCents: number,
  startDate: string,
  endDate: string,
): ProratedPriceBreakdown {
  if (!Number.isInteger(monthlyRateCents) || monthlyRateCents < 0) {
    throw new Error("The monthly rate must be a non-negative integer in cents.");
  }

  const inclusiveDays = countInclusiveDays(startDate, endDate);

  // Locked business rule:
  // (Tarifa Mensual ÷ 31) × inclusive campaign days.
  const proratedBaseCents = Math.round(
    (monthlyRateCents * inclusiveDays) / BILLING_MONTH_DAYS,
  );

  // Locked business rule:
  // Add a 10% premium for selecting exact calendar dates.
  const dateSelectionPremiumCents = Math.round(
    (proratedBaseCents * DATE_SELECTION_PREMIUM_PERCENT) / 100,
  );

  return {
    inclusiveDays,
    monthlyRateCents,
    proratedBaseCents,
    dateSelectionPremiumCents,
    totalCents: proratedBaseCents + dateSelectionPremiumCents,
  };
}
