"use client";

import { FormEvent, MouseEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DateRangeCalendar from "./DateRangeCalendar";
import {
  adCombinations,
  durationOptions,
  formatOptions,
  screenOptions,
  type AdFormat,
  type DurationSeconds,
  type ScreenPackage,
} from "../../data/ad-combinations";
import { addContractCartItem } from "../../lib/cart";
import {
  calculateCampaignPrice,
  DATE_SELECTION_PREMIUM_PERCENT,
  getCampaignRangeError,
  MULTI_MONTH_DISCOUNT_PERCENT,
  pricingBasisLabel,
} from "../../lib/pricing";
import {
  estimatePlaysForServiceHours,
  summarizeServiceSchedule,
} from "../../lib/service-calendar";
import styles from "./order.module.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default function BookingConfigurator() {
  const router = useRouter();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState<DurationSeconds | "">("");
  const [format, setFormat] = useState<AdFormat | "">("");
  const [screen, setScreen] = useState<ScreenPackage | "">("");
  const [message, setMessage] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const dateError = useMemo(() => {
    if (!startDate || !endDate) {
      return "";
    }

    return getCampaignRangeError(startDate, endDate) ?? "";
  }, [startDate, endDate]);

  const serviceSchedule = useMemo(() => {
    if (!startDate || !endDate || dateError) {
      return undefined;
    }

    try {
      return summarizeServiceSchedule(startDate, endDate);
    } catch {
      return undefined;
    }
  }, [startDate, endDate, dateError]);

  const selectedCombination = useMemo(() => {
    if (!duration || !format || !screen) {
      return undefined;
    }

    return adCombinations.find(
      (combination) =>
        combination.durationSeconds === duration &&
        combination.format === format &&
        combination.screenPackage === screen,
    );
  }, [duration, format, screen]);

  const pricing = useMemo(() => {
    if (!selectedCombination || !startDate || !endDate || dateError) {
      return undefined;
    }

    try {
      return calculateCampaignPrice(
        selectedCombination.monthlyRateCents,
        startDate,
        endDate,
      );
    } catch {
      return undefined;
    }
  }, [selectedCombination, startDate, endDate, dateError]);

  const estimatedPlays =
    selectedCombination && pricing
      ? estimatePlaysForServiceHours(
          selectedCombination.playsPer12HourDay,
          pricing.totalServiceHours,
        )
      : undefined;

  const canContinue =
    Boolean(startDate) &&
    Boolean(endDate) &&
    !dateError &&
    Boolean(selectedCombination) &&
    Boolean(pricing);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!canContinue || !selectedCombination) {
      return;
    }

    const result = addContractCartItem({
      sku: selectedCombination.sku,
      startDate,
      endDate,
    });

    if (!result.added) {
      setMessage(
        "This exact combination and date range is already in the contract.",
      );
      return;
    }

    router.push("/cart");
  }

  function openDatePicker(event: MouseEvent<HTMLButtonElement>) {
    const input = event.currentTarget
      .closest("label")
      ?.querySelector("input[type='date']");

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const pickerInput = input as HTMLInputElement & {
      showPicker?: () => void;
    };

    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  return (
    <form className={styles.builder} onSubmit={handleSubmit}>
      <section className={styles.panel}>
        <div className={styles.stepHeading}>
          <span>01</span>
          <div>
            <h2>Select campaign dates</h2>
            <p>
              The start and end dates are both included. Use the
              always-visible calendar or the date fields below. A normal
              operating day provides 12 hours of screen time.
            </p>
          </div>
        </div>

        <div className={styles.fieldGridTwo}>
          <label className={styles.field}>
            <span>Start date</span>
            <div className={styles.dateControl}>
              <input
                className={styles.dateInput}
                type="date"
                min={today}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
              <button
                aria-label="Open calendar for start date"
                className={styles.calendarTrigger}
                onClick={openDatePicker}
                type="button"
              />
            </div>
          </label>

          <label className={styles.field}>
            <span>End date</span>
            <div className={styles.dateControl}>
              <input
                className={styles.dateInput}
                type="date"
                min={startDate || today}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
              <button
                aria-label="Open calendar for end date"
                className={styles.calendarTrigger}
                onClick={openDatePicker}
                type="button"
              />
            </div>
          </label>
        </div>

        <DateRangeCalendar
          startDate={startDate}
          endDate={endDate}
          minDate={today}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        {dateError ? (
          <p className={styles.error} role="alert">
            {dateError}
          </p>
        ) : null}

        {serviceSchedule ? (
          <div className={styles.scheduleSummary}>
            <div>
              <strong>{serviceSchedule.calendarDays}</strong>
              <span>Calendar days</span>
            </div>
            <div>
              <strong>{serviceSchedule.operatingDays}</strong>
              <span>Operating days</span>
            </div>
            <div>
              <strong>{serviceSchedule.closedDays}</strong>
              <span>Closed holidays</span>
            </div>
            <div>
              <strong>{serviceSchedule.totalServiceHours}</strong>
              <span>Scheduled hours</span>
            </div>
          </div>
        ) : null}

        {serviceSchedule?.closedDates.length ? (
          <p className={styles.holidayNotice}>
            Closed in this range:{" "}
            {serviceSchedule.closedDates
              .map((day) => `${day.date} · ${day.name ?? "Closed"}`)
              .join("; ")}.
          </p>
        ) : null}

        {serviceSchedule?.extendedDates.length ? (
          <p className={styles.extendedNotice}>
            Extended hours in this range:{" "}
            {serviceSchedule.extendedDates
              .map((day) => `${day.date} · ${day.name ?? "Extended hours"}`)
              .join("; ")}.
          </p>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.stepHeading}>
          <span>02</span>
          <div>
            <h2>Configure the advertising combination</h2>
            <p>
              Duration × format × screen package produces one full-day,
              source-backed SKU. Daypart is no longer selected.
            </p>
          </div>
        </div>

        <div className={styles.fieldGridThree}>
          <label className={styles.field}>
            <span>Duration</span>
            <select
              value={duration}
              onChange={(event) =>
                setDuration(
                  event.target.value
                    ? (Number(event.target.value) as DurationSeconds)
                    : "",
                )
              }
              required
            >
              <option value="">Select duration</option>
              {durationOptions.map((option) => (
                <option key={option} value={option}>
                  {option} seconds
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Format</span>
            <select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as AdFormat | "")
              }
              required
            >
              <option value="">Select format</option>
              {formatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Screen package</span>
            <select
              value={screen}
              onChange={(event) =>
                setScreen(event.target.value as ScreenPackage | "")
              }
              required
            >
              <option value="">Select screen package</option>
              {screenOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <aside className={styles.summary}>
        <div>
          <p className={styles.summaryLabel}>ITEM SUMMARY</p>

          {selectedCombination && pricing ? (
            <>
              <h2>
                {selectedCombination.durationSeconds}s{" "}
                {selectedCombination.formatLabel}
              </h2>

              <dl className={styles.summaryList}>
                <div>
                  <dt>Screen package</dt>
                  <dd>{selectedCombination.screenLabel}</dd>
                </div>
                <div>
                  <dt>Daily service</dt>
                  <dd>12 hours</dd>
                </div>
                <div>
                  <dt>Calendar days</dt>
                  <dd>{pricing.calendarDays}</dd>
                </div>
                <div>
                  <dt>Operating days</dt>
                  <dd>{pricing.operatingDays}</dd>
                </div>
                <div>
                  <dt>Closed holidays</dt>
                  <dd>{pricing.closedDays}</dd>
                </div>
                <div>
                  <dt>Extended-hour days</dt>
                  <dd>{pricing.extendedDays}</dd>
                </div>
                <div>
                  <dt>Scheduled hours</dt>
                  <dd>{pricing.totalServiceHours}</dd>
                </div>
                <div>
                  <dt>Estimated plays</dt>
                  <dd>{estimatedPlays?.toLocaleString("en-US")}</dd>
                </div>
                <div>
                  <dt>Monthly rate</dt>
                  <dd>
                    {currency.format(
                      selectedCombination.monthlyRateCents / 100,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Pricing basis</dt>
                  <dd>{pricingBasisLabel(pricing)}</dd>
                </div>
                <div>
                  <dt>Full month units</dt>
                  <dd>{pricing.fullMonthUnits}</dd>
                </div>
                <div>
                  <dt>Monthly coverage days</dt>
                  <dd>{pricing.monthlyCoverageDays}</dd>
                </div>
                <div>
                  <dt>Partial calendar days</dt>
                  <dd>{pricing.partialCalendarDays}</dd>
                </div>
                <div>
                  <dt>Partial billable days</dt>
                  <dd>{pricing.partialBillableDays}</dd>
                </div>
                <div>
                  <dt>Total billable days</dt>
                  <dd>{pricing.billableDays}</dd>
                </div>
                <div>
                  <dt>Gross media subtotal</dt>
                  <dd>
                    {currency.format(pricing.grossMediaSubtotalCents / 100)}
                  </dd>
                </div>
                <div>
                  <dt>Closed-holiday subtraction</dt>
                  <dd>
                    {pricing.closedHolidayDeductionCents > 0
                      ? `−${currency.format(
                          pricing.closedHolidayDeductionCents / 100,
                        )}`
                      : "Not applied"}
                  </dd>
                </div>
                <div>
                  <dt>Adjusted media subtotal</dt>
                  <dd>{currency.format(pricing.mediaSubtotalCents / 100)}</dd>
                </div>
                <div>
                  <dt>
                    Date selection premium
                    {pricing.dateSelectionPremiumCents > 0
                      ? ` (${DATE_SELECTION_PREMIUM_PERCENT}%)`
                      : ""}
                  </dt>
                  <dd>
                    {pricing.dateSelectionPremiumCents > 0
                      ? currency.format(
                          pricing.dateSelectionPremiumCents / 100,
                        )
                      : pricing.pricingBasis === "daily-prorated"
                        ? currency.format(0)
                        : "Not applied — monthly rule"}
                  </dd>
                </div>
                <div>
                  <dt>
                    Multi-month discount
                    {pricing.multiMonthDiscountCents > 0
                      ? ` (${MULTI_MONTH_DISCOUNT_PERCENT}%)`
                      : ""}
                  </dt>
                  <dd>
                    {pricing.multiMonthDiscountCents > 0
                      ? `−${currency.format(
                          pricing.multiMonthDiscountCents / 100,
                        )}`
                      : "Not applied"}
                  </dd>
                </div>
                <div>
                  <dt>SKU</dt>
                  <dd>{selectedCombination.sku}</dd>
                </div>
              </dl>

              <div className={styles.priceBlock}>
                <span>Item total</span>
                <strong>{currency.format(pricing.totalCents / 100)}</strong>
              </div>
            </>
          ) : (
            <p className={styles.emptyState}>
              Complete the dates and three package selections to see the item
              schedule and price.
            </p>
          )}
        </div>

        <div>
          {message ? (
            <p className={styles.cartMessage} role="status">
              {message}
            </p>
          ) : null}

          <p className={styles.disclaimer}>
            Every valid date range is admissible. Exact 30–31, 60–61,
            90–91 day ranges—and onward multipliers—are priced as full monthly
            buys. Complete calendar months, including February, also qualify.
            Any remaining days are prorated and receive the 10% exact-date
            premium. Closed holidays are subtracted without activating the
            premium. Exact purchases of two or more monthly units receive the
            10% multi-month discount after holiday deductions.
          </p>

          <button
            className={styles.continueButton}
            type="submit"
            disabled={!canContinue}
          >
            Add to contract
          </button>
        </div>
      </aside>
    </form>
  );
}
