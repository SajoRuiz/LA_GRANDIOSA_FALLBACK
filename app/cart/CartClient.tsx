"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getAdCombinationBySku,
  type AdCombination,
} from "../../data/ad-combinations";
import {
  clearContractCart,
  readContractCart,
  removeContractCartItem,
  type ContractCartItem,
} from "../../lib/cart";
import {
  calculateProratedPrice,
  DATE_SELECTION_PREMIUM_PERCENT,
  type ProratedPriceBreakdown,
} from "../../lib/pricing";
import styles from "./cart.module.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

interface ResolvedCartLine {
  item: ContractCartItem;
  combination: AdCombination;
  pricing: ProratedPriceBreakdown;
}

export default function CartClient() {
  const [items, setItems] = useState<ContractCartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readContractCart());
    setHydrated(true);
  }, []);

  const lines = useMemo<ResolvedCartLine[]>(() => {
    return items.flatMap((item) => {
      const combination = getAdCombinationBySku(item.sku);

      if (!combination) {
        return [];
      }

      return [
        {
          item,
          combination,
          pricing: calculateProratedPrice(
            combination.monthlyRateCents,
            item.startDate,
            item.endDate,
          ),
        },
      ];
    });
  }, [items]);

  const totals = useMemo(() => {
    return lines.reduce(
      (sum, line) => ({
        proratedBaseCents:
          sum.proratedBaseCents + line.pricing.proratedBaseCents,
        dateSelectionPremiumCents:
          sum.dateSelectionPremiumCents +
          line.pricing.dateSelectionPremiumCents,
        totalCents: sum.totalCents + line.pricing.totalCents,
      }),
      {
        proratedBaseCents: 0,
        dateSelectionPremiumCents: 0,
        totalCents: 0,
      },
    );
  }, [lines]);

  function handleRemove(id: string) {
    setItems(removeContractCartItem(id));
  }

  function handleClear() {
    clearContractCart();
    setItems([]);
  }

  if (!hydrated) {
    return (
      <section className={styles.loading} aria-live="polite">
        Loading contract…
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <section className={styles.empty}>
        <h2>Your contract is empty.</h2>
        <p>Select campaign dates and an advertising combination to begin.</p>
        <Link className={styles.primaryButton} href="/order">
          Add first combination
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.contract}>
      <div className={styles.lineList}>
        {lines.map(({ item, combination, pricing }, index) => (
          <article className={styles.lineCard} key={item.id}>
            <div className={styles.lineTop}>
              <div>
                <p className={styles.lineNumber}>
                  CONTRACT ITEM {String(index + 1).padStart(2, "0")}
                </p>
                <h2>
                  {combination.durationSeconds}s {combination.formatLabel}
                </h2>
              </div>

              <button
                className={styles.removeButton}
                type="button"
                onClick={() => handleRemove(item.id)}
              >
                Remove
              </button>
            </div>

            <dl className={styles.lineDetails}>
              <div>
                <dt>Campaign dates</dt>
                <dd>
                  {item.startDate} → {item.endDate}
                </dd>
              </div>
              <div>
                <dt>Inclusive days</dt>
                <dd>{pricing.inclusiveDays}</dd>
              </div>
              <div>
                <dt>Screen package</dt>
                <dd>{combination.screenLabel}</dd>
              </div>
              <div>
                <dt>Daypart</dt>
                <dd>{combination.daypartLabel}</dd>
              </div>
              <div>
                <dt>SKU</dt>
                <dd>{combination.sku}</dd>
              </div>
              <div>
                <dt>Monthly rate</dt>
                <dd>{currency.format(combination.monthlyRateCents / 100)}</dd>
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
            </dl>

            <div className={styles.lineTotal}>
              <span>Item total</span>
              <strong>{currency.format(pricing.totalCents / 100)}</strong>
            </div>
          </article>
        ))}

        <div className={styles.listActions}>
          <Link className={styles.secondaryButton} href="/order">
            Add another combination
          </Link>
          <button
            className={styles.clearButton}
            type="button"
            onClick={handleClear}
          >
            Clear contract
          </button>
        </div>
      </div>

      <aside className={styles.totals}>
        <p className={styles.totalsLabel}>CONTRACT TOTALS</p>
        <h2>
          {lines.length} combination{lines.length === 1 ? "" : "s"}
        </h2>

        <dl className={styles.totalList}>
          <div>
            <dt>Media subtotal</dt>
            <dd>{currency.format(totals.proratedBaseCents / 100)}</dd>
          </div>
          <div>
            <dt>
              Date selection premiums ({DATE_SELECTION_PREMIUM_PERCENT}% on
              1–29 day items only)
            </dt>
            <dd>
              {currency.format(totals.dateSelectionPremiumCents / 100)}
            </dd>
          </div>
        </dl>

        <div className={styles.grandTotal}>
          <span>Contract total</span>
          <strong>{currency.format(totals.totalCents / 100)}</strong>
        </div>

        <p className={styles.notice}>
          Taxes, availability holds, customer identity, legal terms, credit-card
          payment, and customer-code payment will be connected in the next
          production stage.
        </p>

        <button className={styles.disabledButton} type="button" disabled>
          Continue to payment · coming next
        </button>
      </aside>
    </section>
  );
}
