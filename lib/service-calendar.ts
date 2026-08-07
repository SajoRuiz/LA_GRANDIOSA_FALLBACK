export const STANDARD_SERVICE_HOURS = 12;
export const EXTENDED_SERVICE_HOURS = 14;
export const EXTRA_SPECIAL_HOURS = 2;
const DAY_MS = 86_400_000;

// Add approved +2-hour dates here, for example:
// "2026-11-27": "Holiday extended hours"
export const EXTENDED_SERVICE_DATES: Readonly<Record<string, string>> = {};

// Add one-time closures or special elections here.
export const ADDITIONAL_CLOSED_DATES: Readonly<Record<string, string>> = {};

export type ServiceDayStatus = "standard" | "extended" | "closed";
export interface ServiceDay {
  date: string;
  status: ServiceDayStatus;
  hours: number;
  name?: string;
}
export interface ServiceScheduleSummary {
  calendarDays: number;
  operatingDays: number;
  closedDays: number;
  extendedDays: number;
  standardDays: number;
  totalServiceHours: number;
  closedDates: ServiceDay[];
  extendedDates: ServiceDay[];
}

export function parseIsoDateToUtc(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid ISO date: ${value}`);
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) throw new Error(`Invalid calendar date: ${value}`);
  return date;
}

export function formatUtcDateToIso(date: Date): string {
  return `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function countInclusiveCalendarDays(startDate: string, endDate: string): number {
  const start = parseIsoDateToUtc(startDate);
  const end = parseIsoDateToUtc(endDate);
  if (end < start) throw new Error("The end date must be on or after the start date.");
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function nthWeekday(year: number, month: number, weekday: number, nth: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (nth - 1) * 7));
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function electionDay(year: number): Date | undefined {
  if (year % 4 !== 0) return undefined;
  return addUtcDays(nthWeekday(year, 10, 1, 1), 1);
}

function closedHolidayName(date: Date): string | undefined {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const iso = formatUtcDateToIso(date);
  if (m === 0 && d === 1) return "New Year's Day";
  if (m === 0 && d === 6) return "Three Kings Day";
  if (m === 11 && d === 25) return "Christmas Day";
  if (iso === formatUtcDateToIso(addUtcDays(easterSunday(y), -2))) return "Good Friday";
  if (iso === formatUtcDateToIso(nthWeekday(y, 4, 0, 2))) return "Mother's Day";
  if (iso === formatUtcDateToIso(nthWeekday(y, 5, 0, 3))) return "Father's Day";
  if (iso === formatUtcDateToIso(nthWeekday(y, 10, 4, 4))) return "Thanksgiving Day";
  const election = electionDay(y);
  if (election && iso === formatUtcDateToIso(election)) return "Election Day";
  return undefined;
}

export function getServiceDay(dateValue: string): ServiceDay {
  const date = parseIsoDateToUtc(dateValue);
  const closed = ADDITIONAL_CLOSED_DATES[dateValue] ?? closedHolidayName(date);
  if (closed) return { date: dateValue, status: "closed", hours: 0, name: closed };
  const extended = EXTENDED_SERVICE_DATES[dateValue];
  if (extended) return { date: dateValue, status: "extended", hours: EXTENDED_SERVICE_HOURS, name: extended };
  return { date: dateValue, status: "standard", hours: STANDARD_SERVICE_HOURS };
}

export function summarizeServiceSchedule(startDate: string, endDate: string): ServiceScheduleSummary {
  const start = parseIsoDateToUtc(startDate);
  const end = parseIsoDateToUtc(endDate);
  if (end < start) throw new Error("The end date must be on or after the start date.");
  const days: ServiceDay[] = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) {
    days.push(getServiceDay(formatUtcDateToIso(cursor)));
  }
  const closedDates = days.filter((day) => day.status === "closed");
  const extendedDates = days.filter((day) => day.status === "extended");
  return {
    calendarDays: days.length,
    operatingDays: days.length - closedDates.length,
    closedDays: closedDates.length,
    extendedDays: extendedDates.length,
    standardDays: days.filter((day) => day.status === "standard").length,
    totalServiceHours: days.reduce((sum, day) => sum + day.hours, 0),
    closedDates,
    extendedDates,
  };
}

export function estimatePlaysForServiceHours(playsPer12HourDay: number, totalServiceHours: number): number {
  if (playsPer12HourDay < 0 || totalServiceHours < 0) throw new Error("Values must be non-negative.");
  return Math.round((playsPer12HourDay / STANDARD_SERVICE_HOURS) * totalServiceHours);
}
