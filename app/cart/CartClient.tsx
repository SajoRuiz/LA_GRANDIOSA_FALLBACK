"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getAdCombinationBySku,
  type AdCombination,
} from "../../data/ad-combinations";
import {
  calculateAgencyPricing,
  discountPolicyLabel,
  projectAgencyCredit,
  type AgencyCreditSummary,
  type DiscountPolicy,
} from "../../lib/agency-pricing";
import {
  clearContractCart,
  readContractCart,
  removeContractCartItem,
  type ContractCartItem,
} from "../../lib/cart";
import {
  calculateCampaignPrice,
  DATE_SELECTION_PREMIUM_PERCENT,
  MULTI_MONTH_DISCOUNT_PERCENT,
  pricingBasisLabel,
  type CampaignPriceBreakdown,
} from "../../lib/pricing";
import { estimatePlaysForServiceHours } from "../../lib/service-calendar";
import styles from "./cart.module.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

interface ResolvedCartLine {
  item: ContractCartItem;
  combination: AdCombination;
  pricing: CampaignPriceBreakdown;
  estimatedPlays: number;
}

interface CartAgencyProps {
  displayName: string;
  accountNumber: string;
  discountBasisPoints: number;
  discountPolicy: DiscountPolicy;
  paymentTermsDays: number;
}

interface CartClientProps {
  agency: CartAgencyProps;
  credit: AgencyCreditSummary;
}

export default function CartClient({ agency, credit }: CartClientProps) {
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

      const pricing = calculateCampaignPrice(
        combination.monthlyRateCents,
        item.startDate,
        item.endDate,
      );

      return [
        {
          item,
          combination,
          pricing,
          estimatedPlays: estimatePlaysForServiceHours(
            combination.playsPer12HourDay,
            pricing.totalServiceHours,
          ),
        },
      ];
    });
  }, [items]);

  const totals = useMemo(() => {
    return lines.reduce(
      (sum, line) => ({
        grossMediaSubtotalCents:
          sum.grossMediaSubtotalCents +
          line.pricing.grossMediaSubtotalCents,
        closedHolidayDeductionCents:
          sum.closedHolidayDeductionCents +
          line.pricing.closedHolidayDeductionCents,
        mediaSubtotalCents:
          sum.mediaSubtotalCents + line.pricing.mediaSubtotalCents,
        dateSelectionPremiumCents:
          sum.dateSelectionPremiumCents +
          line.pricing.dateSelectionPremiumCents,
        multiMonthDiscountCents:
          sum.multiMonthDiscountCents +
          line.pricing.multiMonthDiscountCents,
        totalCents: sum.totalCents + line.pricing.totalCents,
      }),
      {
        grossMediaSubtotalCents: 0,
        closedHolidayDeductionCents: 0,
        mediaSubtotalCents: 0,
        dateSelectionPremiumCents: 0,
        multiMonthDiscountCents: 0,
        totalCents: 0,
      },
    );
  }, [lines]);

  const agencyPricing = useMemo(
    () =>
      calculateAgencyPricing(
        {
          preDiscountTotalCents:
            totals.mediaSubtotalCents +
            totals.dateSelectionPremiumCents,
          campaignDiscountAvailableCents:
            totals.multiMonthDiscountCents,
        },
        {
          discountBasisPoints: agency.discountBasisPoints,
          discountPolicy: agency.discountPolicy,
        },
      ),
    [
      agency.discountBasisPoints,
      agency.discountPolicy,
      totals.dateSelectionPremiumCents,
      totals.mediaSubtotalCents,
      totals.multiMonthDiscountCents,
    ],
  );

  const creditProjection = useMemo(
    () =>
      projectAgencyCredit(
        credit.availableCreditCents,
        agencyPricing.netContractTotalCents,
      ),
    [agencyPricing.netContractTotalCents, credit.availableCreditCents],
  );

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
        {lines.map(({ item, combination, pricing, estimatedPlays }, index) => (
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
                <dt>Calendar days</dt>
                <dd>{pricing.calendarDays}</dd>
              </div>
              <div>
                <dt>Screen package</dt>
                <dd>{combination.screenLabel}</dd>
              </div>
              <div>
                <dt>Daily service</dt>
                <dd>12 hours</dd>
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
                <dd>{estimatedPlays.toLocaleString("en-US")}</dd>
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
                    : pricing.partialCalendarDays > 0
                      ? currency.format(0)
                      : "Not applied — no partial remainder"}
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
            <dt>Gross media subtotal</dt>
            <dd>
              {currency.format(totals.grossMediaSubtotalCents / 100)}
            </dd>
          </div>
          <div>
            <dt>Closed-holiday subtractions</dt>
            <dd>
              {totals.closedHolidayDeductionCents > 0
                ? `−${currency.format(
                    totals.closedHolidayDeductionCents / 100,
                  )}`
                : currency.format(0)}
            </dd>
          </div>
          <div>
            <dt>Adjusted media subtotal</dt>
            <dd>{currency.format(totals.mediaSubtotalCents / 100)}</dd>
          </div>
          <div>
            <dt>
              Date selection premiums ({DATE_SELECTION_PREMIUM_PERCENT}% on
              partial items)
            </dt>
            <dd>
              {currency.format(totals.dateSelectionPremiumCents / 100)}
            </dd>
          </div>
          <div>
            <dt>
              Multi-month discounts ({MULTI_MONTH_DISCOUNT_PERCENT}%)
            </dt>
            <dd>
              {totals.multiMonthDiscountCents > 0
                ? `−${currency.format(
                    totals.multiMonthDiscountCents / 100,
                  )}`
                : currency.format(0)}
            </dd>
          </div>
        </dl>

        <section className={styles.agencyPricing}>
          <p className={styles.totalsLabel}>NEGOTIATED AGENCY PRICING</p>
          <dl className={styles.totalList}>
            <div>
              <dt>Public published total</dt>
              <dd>
                {currency.format(
                  agencyPricing.publicPublishedTotalCents / 100,
                )}
              </dd>
            </div>
            <div>
              <dt>Discount policy</dt>
              <dd>{discountPolicyLabel(agency.discountPolicy)}</dd>
            </div>
            {agencyPricing.agencyDiscountBaseCents !==
            agencyPricing.publicPublishedTotalCents ? (
              <div>
                <dt>Agency pricing base</dt>
                <dd>
                  {currency.format(
                    agencyPricing.agencyDiscountBaseCents / 100,
                  )}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Negotiated discount</dt>
              <dd>
                {agency.discountBasisPoints > 0
                  ? `${(agency.discountBasisPoints / 100).toFixed(2)}%`
                  : "0%"}
              </dd>
            </div>
            <div>
              <dt>Agency discount applied</dt>
              <dd>
                {agencyPricing.agencyDiscountCents > 0
                  ? `−${currency.format(
                      agencyPricing.agencyDiscountCents / 100,
                    )}`
                  : currency.format(0)}
              </dd>
            </div>
          </dl>
        </section>

        <div className={styles.grandTotal}>
          <span>Agency contract total</span>
          <strong>
            {currency.format(
              agencyPricing.netContractTotalCents / 100,
            )}
          </strong>
        </div>

        <section className={styles.creditPanel}>
          <p className={styles.totalsLabel}>CREDIT PROJECTION</p>
          <dl className={styles.totalList}>
            <div>
              <dt>Approved credit</dt>
              <dd>
                {currency.format(
                  credit.approvedCreditLimitCents / 100,
                )}
              </dd>
            </div>
            <div>
              <dt>Current exposure</dt>
              <dd>
                {currency.format(credit.currentExposureCents / 100)}
              </dd>
            </div>
            <div>
              <dt>Available before this order</dt>
              <dd>
                {currency.format(credit.availableCreditCents / 100)}
              </dd>
            </div>
            <div>
              <dt>Credit requested</dt>
              <dd>
                {currency.format(
                  creditProjection.requestedCreditCents / 100,
                )}
              </dd>
            </div>
            <div>
              <dt>Projected available credit</dt>
              <dd>
                {currency.format(
                  creditProjection.availableCreditAfterCents / 100,
                )}
              </dd>
            </div>
          </dl>
          <p
            className={
              creditProjection.status === "within_limit"
                ? styles.creditApproved
                : styles.creditReview
            }
          >
            {creditProjection.status === "within_limit"
              ? `Within the approved credit limit · Net ${agency.paymentTermsDays}`
              : `Finance review required · Credit shortfall ${currency.format(
                  creditProjection.shortfallCents / 100,
                )}`}
          </p>
        </section>

        <p className={styles.notice}>
          Continue to the mandatory client-information form. The server will
          recalculate campaign pricing, apply the agency agreement stored in
          Supabase, and create either an active credit hold or a finance-review
          request. Purchase-order upload and invoice generation follow in Stage
          3B-C.
        </p>

        <Link className={styles.checkoutButton} href="/checkout/client">
          Continue to client information
        </Link>
      </aside>
    </section>
  );
}
