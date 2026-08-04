"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adCombinations,
  daypartOptions,
  durationOptions,
  formatOptions,
  screenOptions,
  type AdFormat,
  type Daypart,
  type DurationSeconds,
  type ScreenPackage,
} from "../../data/ad-combinations";
import { addContractCartItem } from "../../lib/cart";
import {
  calculateProratedPrice,
  countInclusiveDays,
  DATE_SELECTION_PREMIUM_PERCENT,
  MAX_SUPPORTED_CAMPAIGN_DAYS,
} from "../../lib/pricing";
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
  const [daypart, setDaypart] = useState<Daypart | "">("");
  const [message, setMessage] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const inclusiveDays = useMemo(() => {
    if (!startDate || !endDate) {
      return undefined;
    }

    try {
      return countInclusiveDays(startDate, endDate);
    } catch {
      return undefined;
    }
  }, [startDate, endDate]);

  const dateError =
    startDate && endDate && !inclusiveDays
      ? "The end date must be on or after the start date."
      : inclusiveDays && inclusiveDays > MAX_SUPPORTED_CAMPAIGN_DAYS
        ? `This checkout currently supports campaign ranges of up to ${MAX_SUPPORTED_CAMPAIGN_DAYS} inclusive days.`
        : "";

  const selectedCombination = useMemo(() => {
    if (!duration || !format || !screen || !daypart) {
      return undefined;
    }

    return adCombinations.find(
      (combination) =>
        combination.durationSeconds === duration &&
        combination.format === format &&
        combination.screenPackage === screen &&
        combination.daypart === daypart,
    );
  }, [duration, format, screen, daypart]);

  const pricing = useMemo(() => {
    if (!selectedCombination || !startDate || !endDate || dateError) {
      return undefined;
    }

    return calculateProratedPrice(
      selectedCombination.monthlyRateCents,
      startDate,
      endDate,
    );
  }, [selectedCombination, startDate, endDate, dateError]);

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

  return (
    <form className={styles.builder} onSubmit={handleSubmit}>
      <section className={styles.panel}>
        <div className={styles.stepHeading}>
          <span>01</span>
          <div>
            <h2>Select campaign dates</h2>
            <p>
              The start and end dates are both included in the billable
              campaign range.
            </p>
          </div>
        </div>

        <div className={styles.fieldGridTwo}>
          <label className={styles.field}>
            <span>Start date</span>
            <input
              type="date"
              min={today}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span>End date</span>
            <input
              type="date"
              min={startDate || today}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
          </label>
        </div>

        {dateError ? (
          <p className={styles.error} role="alert">
            {dateError}
          </p>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.stepHeading}>
          <span>02</span>
          <div>
            <h2>Configure the advertising combination</h2>
            <p>
              Duration × format × screen package × daypart produces one
              source-backed SKU.
            </p>
          </div>
        </div>

        <div className={styles.fieldGridFour}>
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

          <label className={styles.field}>
            <span>Daypart</span>
            <select
              value={daypart}
              onChange={(event) =>
                setDaypart(event.target.value as Daypart | "")
              }
              required
            >
              <option value="">Select daypart</option>
              {daypartOptions.map((option) => (
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
                  <dt>Daypart</dt>
                  <dd>{selectedCombination.daypartLabel}</dd>
                </div>
                <div>
                  <dt>Inclusive days</dt>
                  <dd>{pricing.inclusiveDays}</dd>
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
                  <dd>
                    {pricing.pricingBasis === "monthly-buy"
                      ? "Monthly buy"
                      : "Daily proration"}
                  </dd>
                </div>
                <div>
                  <dt>Media subtotal</dt>
                  <dd>{currency.format(pricing.proratedBaseCents / 100)}</dd>
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
              Complete the dates and four package selections to see the
              prorated item total.
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
            Pricing rule: campaigns of 1–29 inclusive days are prorated from
            Tarifa Mensual and receive a 10% exact-date selection premium.
            Campaigns of 30 or 31 inclusive days are monthly buys at Tarifa
            Mensual with no premium. Availability is not yet reserved in this
            prototype.
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
