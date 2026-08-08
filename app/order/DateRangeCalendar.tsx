"use client";

import { useMemo, useState } from "react";
import styles from "./order.module.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DateRangeCalendarProps {
  startDate: string;
  endDate: string;
  minDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(date: Date): string {
  return [
    date.getUTCFullYear().toString().padStart(4, "0"),
    (date.getUTCMonth() + 1).toString().padStart(2, "0"),
    date.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}

function monthStart(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  );
}

function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
    ),
  );
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildMonthCells(month: Date): Array<Date | null> {
  const firstDayOffset = month.getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(
      month.getUTCFullYear(),
      month.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();

  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstDayOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      new Date(
        Date.UTC(
          month.getUTCFullYear(),
          month.getUTCMonth(),
          day,
        ),
      ),
    );
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function CalendarMonth({
  month,
  startDate,
  endDate,
  minDate,
  onSelect,
  secondary = false,
}: {
  month: Date;
  startDate: string;
  endDate: string;
  minDate: string;
  onSelect: (value: string) => void;
  secondary?: boolean;
}) {
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section
      className={`${styles.calendarMonth} ${
        secondary ? styles.calendarMonthSecondary : ""
      }`}
      aria-label={monthLabel(month)}
    >
      <h3>{monthLabel(month)}</h3>

      <div className={styles.calendarWeekdays} aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className={styles.calendarDays}>
        {cells.map((date, index) => {
          if (!date) {
            return (
              <span
                className={styles.calendarBlank}
                key={`blank-${index}`}
              />
            );
          }

          const iso = formatIsoDate(date);
          const disabled = iso < minDate;
          const selectedStart = iso === startDate;
          const selectedEnd = iso === endDate;
          const inRange =
            Boolean(startDate) &&
            Boolean(endDate) &&
            iso > startDate &&
            iso < endDate;
          const isToday = iso === today;

          const className = [
            styles.calendarDay,
            selectedStart || selectedEnd
              ? styles.calendarDaySelected
              : "",
            inRange ? styles.calendarDayInRange : "",
            isToday ? styles.calendarDayToday : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              className={className}
              type="button"
              key={iso}
              disabled={disabled}
              aria-pressed={selectedStart || selectedEnd}
              aria-label={new Intl.DateTimeFormat("en-US", {
                dateStyle: "full",
                timeZone: "UTC",
              }).format(date)}
              onClick={() => onSelect(iso)}
            >
              {date.getUTCDate()}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function DateRangeCalendar({
  startDate,
  endDate,
  minDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangeCalendarProps) {
  const initialMonth = monthStart(
    parseIsoDate(startDate || minDate),
  );
  const [visibleMonth, setVisibleMonth] =
    useState<Date>(initialMonth);

  function handleSelect(value: string) {
    if (!startDate || endDate) {
      onStartDateChange(value);
      onEndDateChange("");
      return;
    }

    if (value < startDate) {
      onStartDateChange(value);
      onEndDateChange("");
      return;
    }

    onEndDateChange(value);
  }

  function handleClear() {
    onStartDateChange("");
    onEndDateChange("");
  }

  const instruction = !startDate
    ? "Select the campaign start date."
    : !endDate
      ? "Now select the campaign end date."
      : "The selected date range is highlighted.";

  return (
    <div className={styles.inlineCalendar}>
      <div className={styles.calendarToolbar}>
        <div className={styles.calendarNavigation}>
          <button
            type="button"
            onClick={() =>
              setVisibleMonth((current) =>
                addMonths(current, -1),
              )
            }
            aria-label="Show previous month"
          >
            ←
          </button>

          <button
            type="button"
            onClick={() =>
              setVisibleMonth(
                monthStart(parseIsoDate(minDate)),
              )
            }
          >
            Today
          </button>

          <button
            type="button"
            onClick={() =>
              setVisibleMonth((current) =>
                addMonths(current, 1),
              )
            }
            aria-label="Show next month"
          >
            →
          </button>
        </div>

        <p className={styles.calendarInstruction} aria-live="polite">
          {instruction}
        </p>

        <button
          className={styles.calendarClear}
          type="button"
          onClick={handleClear}
          disabled={!startDate && !endDate}
        >
          Clear dates
        </button>
      </div>

      <div className={styles.calendarMonths}>
        <CalendarMonth
          month={visibleMonth}
          startDate={startDate}
          endDate={endDate}
          minDate={minDate}
          onSelect={handleSelect}
        />

        <CalendarMonth
          month={addMonths(visibleMonth, 1)}
          startDate={startDate}
          endDate={endDate}
          minDate={minDate}
          onSelect={handleSelect}
          secondary
        />
      </div>
    </div>
  );
}
